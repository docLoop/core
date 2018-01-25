'use strict'



var 	ObjectId 		= 	require('mongodb').ObjectID,
		Promise			= 	require('bluebird'),
		DocloopError		= 	require('./docloop-error-handling.js').DocloopError


//TODO: Tests


//TODO: Decor?

/**
 * @memberof  	module:Docloop
 * @param		{DocloopCore}		core						The core system. Since Core is a Factory for Links, this param will usually be set automatically.
 * @param		{Object}			data
 * @param		{Object}			data.source
 * @param		{Identifier}		data.source.identifier		An {@link Identifier} pointing at an extrernal source.
 * @param		{Object}			data.target
 * @param		{Identifier}		data.target.identifier		An {@link Identifier} pointing at an extrernal target resource.
 * @poerty		{bson}				id
 * @property	{DocloopEndpoint}	source						An endpoint representing a source of annotations
 * @property	{DocloopEndpoint}	target						An endpoint representing a target resource for issues
 */
class DocloopLink {

	constructor(core, data){


		if(!core) 									throw new ReferenceError("Link.constructor() missing core")
		if(core.constructor.name != 'DocloopCore') 	throw new TypeError("Link.constructor() expected core to be instance of DocloopCore got "+core)

		this.core = core


		var id 		= 	undefined,
			data	=	undefined

		if(data) throw new ReferenceError("Link.constructor() missing data")
		
		this.importData(data)
	}

	/**
	 * TODO
	 */

	importData({source, target}){
		if(!source)				throw new ReferenceError("Link.importData() missing source")
		if(!target)				throw new ReferenceError("Link.importData() missing target")

		if(!source.identifier) 	throw new ReferenceError("Link.importData() missing source identifier")
		if(!target.identifier) 	throw new ReferenceError("Link.importData() missing target identifier")


		var source_adapter	= this.core.adapters[source.identifier.adapter],
		 	target_adapter	= this.core.adapters[target.identifier.adapter]

		if(!source_adapter)		throw new Error("Link.importData() no matching source adapter found")
		if(!target_adapter)		throw new Error("Link.importData() no matching target adapter found")


		this.source	=	source_adapter.newEndpoint(source)
		this.target	=	target_adapter.newEndpoint(target)

	}

	/**
	 * Extracts raw data from the link
	 * @return {Object}
	 */
	get export(){
		return {
			id:		this.id,
			source: this.source.export,
			target:	this.target.export,
		}
	}

	/**
	 * @typedef 	{Object} 					DocloopLinkSkeleton
	 * @property 	{bson}						id						Link id 
	 * @property 	{EndpointSkeleton}			source					Source skeleton	
	 * @property 	{EndpointSkeleton}			target					Target skeleton
	 */


	/**
	 * Extracts minimal data from the link to find it in the database
	 * @return {Object}
	 */
	get skeleton(){
		return {
			id:		this.id || undefined,
			source:	this.source.skeleton,
			target:	this.target.skeleton
		}
	}

	/**
	 * Check if there already exists a link with the same source identifier and the same target identifier as the link at hand. If so throws and error.
	 * @async
	 * @return 	{this}			for chaining
	 * @throws	{DocloopError}		If duplicate exists
	 */
	async preventDuplicate(){

		var sources 		= 	await	this.source.adapter.endpoints.find({identifier: this.source.identifier}).toArray(),
			targets 		= 	await	this.target.adapter.endpoints.find({identifier: this.target.identifier}).toArray()
			
		if(sources.length == 0) return this
		if(targets.length == 0) return this

		var source_queries	= 	sources.map( source => ({ "source.id" : this.skeleton.source.id, "source.adapter": this.skeleton.source.adapter}) ),
			target_queries	= 	targets.map( target => ({ "target.id" : this.skeleton.target.id, "source.adapter": this.skeleton.target.adapter}) ),
			duplicates 		= 	await this.core.links.find({
									"$and":[
										 {"$or": source_queries },
										 {"$or": target_queries }
									]
								}).toArray()
		
		if(duplicates.length > 0) throw new DocloopError("Link.preventDuplicate() duplicate found", 409)

		return this
	}


	//TODO: refuse doble store?? Also double store for source and target?


	/**
	 * Stores the link to the database as new document. First it stores its source and target, then stores a new document using the data from {@link DocLLoopLink#.skeleton}
	 * @async
	 * @return {bson}	The mongo-db id for the inserted document.
	 */
	async store() {	

		if(!this.source) throw new ReferenceError("Link.store() missing source")
		if(!this.target) throw new ReferenceError("Link.store() missing target")

		var [source_id, target_id] 	= 	await 	Promise.all([ 
													this.source.store(), 
													this.target.store()	
												]),

			result					= 	await	this.core.links.insertOne(this.skeleton)

		//TODO: Error result

		this.id = result.insertedId

		return this.id
	}

	/**
	 * Updates source and target using {@link DocloopEndpoint#update}
	 * @async
	 */
	async update(){
		if(!this.source) throw new ReferenceError("Link.update() missing source")
		if(!this.target) throw new ReferenceError("Link.update() missing target")	

		await this.source.update()
		await this.target.update()
	}

	/**
	 * Removes the link from the database. First it removes source and target from the database, then the actual link document.
	 * @async
	 * @return {undefined}
	 */
	async remove() {

		if(!this.id) throw new ReferenceError("Link.remove() missing id")

		//TODO check if source and target exist

		//TODO: also remove endpoints

		await this.source.remove()
		await this.target.remove()

		var deletetion = await this.core.links.deleteOne({_id:  this.id})

		if(deletetion.result.n != 1) throw new Error("Link.remove() db failed to remove link")

	}

	/**
	 * Checks if the current session has acces to source and target with {@link Endpoint#_validate}
	 * @param  {session}		Express session
	 * @return {undefined}
	 */
	async _validate(session){
		try{ 		await this.source._validate(session) }
		catch(e){	throw new DocloopError("Link.validate() unable to validate source "+e, e.status)	}

		try{ 		await this.target._validate(session) }
		catch(e){	throw new DocloopError("Link.validate() unable to validate target "+e, e.status)	}
	}

}

module.exports = DocloopLink