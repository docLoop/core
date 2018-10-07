'use strict'


const	DocloopAdapter	=	require('./docloop-adapter.js'),
		DocloopError	=	require('./docloop-error-handling.js').DocloopError,
		ObjectId 		= 	require('mongodb').ObjectID


/**
 * An endpoint class is either {@link module:docloop.DocloopEndpoint DocloopEndpoint} or any class extending it.
 * @typedef		{Class} EndpointClass
 * @alias		EndpointClass
 * @memberof	DocloopEndpoint
 */


/**
 * An endpoint is an instance of either {@link module:docloop.DocloopEndpoint DocloopEndpoint} or any class extending it.
 * @typedef	{Object} Endpoint
 * @alias 		Endpoint
 * @memberof	DocloopEndpoint
 */


/**
 * A valid endpoint is an endpoint that passes .validate() for the current session.
 * Iff an endpoint is considered valid for a session, all links associated with this endpoint can be modified during this session.
 * @typedef 	{Endpoint} ValidEndpoint
 * @alias		ValidEndpoint
 * @memberof	DocloopEndpoint
 */


/**
 * TODO!
 * @typedef {Object}	Annotation
 */

/**
 * TODO!
 * @typedef {Object}	Reply
 */


/**
 * Identifiers describe external resources to be used by an adapter. 
 * They will always have at least the adapter property and the external resource should be uniquely determined by the remaining properties. 
 * Two Endpoints can have euqal identifiers, if for example they are part of two different Links.
 * 
 * @typedef 	{Object} Identifier
 * @memberof	DocloopEndpoint
 * @alias		Identifier
 * 
 * @property 	{string} adapter		An adapter id.
 * @property 	{...*}					Any other properties.
 */

/**
 * A Decoration object stores all the data the client needs in order to nicely display the resource pointed to by an identfier.
 * 
 * @typedef 	{Object} Decoration	
 * @memberof	DocloopEndpoint
 * @alias		Decoration
 * 
 * @property	{String} [image=null] 					Url of an image
 * @property 	{String} [title='Generic Endpoint']		Title of the resource, the identifier points to
 * @property	{String} [details='unknown']			Additonal information concerning the resource, the identfier points to
 */




/**
 * This is the base class for all endpoints, sources and targets alike. Any source or target should extend DocloopEndpoint.
 * 
 * @memberof 	module:docloop
 * @alias		DocloopEndpoint
 *
 * @param 		{DocloopAdapter} 	 adapter 		
 * @param 		{EndpointData} 		 data 				Set the corresponding proprties on the endpoint object.
 * 
 * @property 	{Identifier} 		 identifier			Uniquely identifies an external resource
 * @property 	{config} 			 config				Configuration data
 * @property	{Decoration}		 decor				Extra data for the client for visualization
 * @property	{DocloopAdapter}	 adapter			The adapter an endpoint is associated with 
 * @property	{bson}				 id					
 
 * @property	{EndpointSkeleton}	 skeleton			Getter
 * @property	{EndpointData}		 export				Getter			

 */

class DocloopEndpoint {

	constructor(adapter, {id, _id, identifier, config, decor} = {}){

		if(!adapter)										throw new ReferenceError("Endpoint.constructor() missing adapter")

		if(!identifier)										throw new ReferenceError("Endpoint.constructor() missing identifier")
		if(!identifier.adapter)								throw new ReferenceError("Endpoint.constructor() missing identifier.adapter")
		
		if(adapter.id != identifier.adapter)				throw new DocloopError("Endpoint.constructor adapter/identifier mismatch; got: "+adapter.id+'/'+identifier.adapter)

		this.id				=	id || _id || undefined

		if(this.id && (this.id._bsontype != 'ObjectID') ) this.id = ObjectId(this.id)

		this.adapter 		= 	adapter
		this.identifier		= 	identifier
		this.config			= 	config || {}

		this.decor			= 	decor || {
									image:		null,
									title:		'Generic endpoint',
									details:	'unknown'
								}
	}



	/**
	 * This method is meant to be overwritten by a custom endpoint class. Returns a single valid endpoint guessed from the provided string.
	 * @static
	 * @async
	 * @abstract
	 * @param  	{string}				str				A string to guess the Endpoint identifier from
	 * @param  	{SessionData}			session_data	Data of the current session associated with this adapter
	 * @return 	{ValidEndpoint}
	 *
	 * @throw	{DocloopError}							If no valid endpoint can be guessed.
	 */
	static async guess(){
		throw new DocloopError("Endpoint.guess() not implemented for this endpoint class: "+ this.toString().match(/class\s([^\s]*)/)[1])
	}

	/**
	 * Minimal data to instantiate a new {@link Endpoint}. Also: all the data the client might need.
	 * 
	 * @typedef 	{Object} EndpointData
	 * @memberof	DocloopEndpoint
	 * @alias		EndpointData
	 * 
	 * @property	{String|bson}		[id]				The endpoint id.
	 * @property	{String|bson}		[_id]				If id is not present _id will be used. This is handy, if the data comes directly form the database.
	 * @property 	{Identifier} 		 identifier			Uniquely identifies an external resource
	 * @property 	{config} 			[config]			Configuration data
	 * @property	{Decoration}		[decor]				Extra data for the client for visualization
	 */
	 
	
	get export(){
		return 	{
					identifier: this.identifier,
					config:		this.config,
					decor:		this.decor
				}
	}

	/**
	 * The skeleton of an endpoint is a minimal set of data to identify an endpoint. 
	 * Since adapters store endpoint data individually, the endpoint id alone is not enough.
	 * 
	 * @typedef 	{Object}		EndpointSkeleton
	 * @memberof	DocloopEndpoint
	 * @alias		EndpointSkeleton
	 * 
	 * @property 	{bson} 		id 			Endpoint id
	 * @property 	{String}	adapter		Adapter id
	 */

	
	get skeleton(){
		return {
			id:			this.id,
			adapter: 	this.identifier.adapter
		}
	}

	/**
	 * Stores the endpoint to the database as new document. (Using the data from .export)
	 * @async
	 * @return {bson}	The mongo-db id for the inserted document.
	 */
	async store(){
		var result = await this.adapter.endpoints.insertOne(this.export)

		return this.id = result.insertedId
	}


	//TODO: Maybe refuse to update identifiers, force delete/recreate

	/**
	 * Updates document associated with the endpoint using the data from .export.
	 *
	 * @async
	 * 
	 * @return 	{undefined}
	 * 
	 * @throws	{ReferenceError}	If this.id is undefined (i.e. the endpoint has not been stored yet)
	 */
	async update(){
		if(this.id === undefined) 		throw new DocloopError("Endpoint.update() missing id. To update an endpoint it must have been stored first.")

		var result 	= 	await this.adapter.endpoints.updateOne(
							{_id: 	this.id},
							{ $set: this.export}
						)

		if(result.nMatched  == 0) 		throw new Error("Endpoint.update(): not found "+ result)

		if(result.writeError) 			throw new Error("Endpoint.update(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Error("Endpoint.update(); write concern error: "+result.writeConcernError)
	}

	/**
	 * Stores arbitrary data alongside the endpoint document.
	 * 
	 * @async
	 * 
	 * @param {String}					key		A key to store the data at.
	 * @param {Object|String|Number}	data 	The data to be stored at the key.
	 * 
	 * @returns undefined
	 */
	async setData(key, data){
		if(key 	=== undefined)			throw new ReferenceError("Endpoint.setData() missing key.")	
		if(typeof key != 'string')		throw new TypeError		("Endpoint.setData() key must be a string; got: " + (typeof key))	
		if(data === undefined)			throw new ReferenceError("Endpoint.setData() missing data.")


		if(this.id === undefined) 		throw new DocloopError("Endpoint.setData() missing id. To set data for an endpoint it must have been stored first.")


		var result 	= 	await this.adapter.endpoints.updateOne(
							{_id: 	this.id},
							{ $set: {['data.'+key]: data}}
						)

		if(result.nMatched  == 0) 		throw new Error("Endpoint.setData(): not found "+ result)

		if(result.writeError) 			throw new Error("Endpoint.setData(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Error("Endpoint.setData(); write concern error: "+result.writeConcernError)
	}


	/**
	 * Retrieves data stored alongside the endpoint document.
	 * 
	 * @async
	 * 
	 * @param  {String}					key		The key, where the data is stored at.
	 * 
	 * @return {Object|String|Number}			Data stored at the key.
	 */
	async getData(key){

		if(key 	=== undefined)			throw new ReferenceError("Endpoint.getData() missing key.")	
		if(typeof key != 'string')		throw new TypeError		("Endpoint.getData() key must be a string; got: " + (typeof key))	

		if(this.id === undefined) 		throw new DocloopError("Endpoint.getData() missing id. To get data for an endpoint it must have been stored first.")


		key = 'data.'+key

		var  data = await this.adapter.endpoints.findOne({_id: this.id})

		return key.split('.').reduce( (r, part) => r && r[part], data)

	}

	/**
	 * Removes te endpoint document from the database.
	 * 
	 * @async
	 * 
	 * @return {undefined}
	 */
	async remove(){
		if(this.id === undefined) 		throw new DocloopError("Endpoint.remove() missing id. To remove an endpoint it must have been stored first.")

		var deletetion = await this.adapter.endpoints.deleteOne({_id:  this.id})

		if(deletetion.result.n != 1) throw new DocloopError("Endpoint.remove() db failed to remove endpoint")
	}

	//TODO: use _validate!

	/**
	 * Calls {@link DocloopEndpoint#validate} with {@link SessionData}
	 * 
	 * @async
	 * 
	 * @param  {Session}		session
	 * 
	 * @return {undefined}
	 */
	async _validate(session){
		await this.validate(this.adapter._getSessionData(session))
	}

	/**
	 * This method is meant ot bew overwritten. Checks if the current session has access to the resource pointed at by the endpoint's identifier. Whenever an endpoint passes .validate() 
	 * the endpoint and any link using this endpoint can be modified during this session.
	 * 
	 * @async
	 *
	 * @abstract
	 * 
	 * @param  {SessionData}	
	 * 	
	 * @return {undefined}
	 */
	async validate(session_data){
		throw new DocloopError("Endpoint.validate() not implemented for this adapter: "+this.adapter.id)
	}


	/**
	 * Calls .updateDecor with {@link SessionData}.
	 *
	 * @param 	{Session} 		session 
	 * @return 	{undefined}
	 */
	async _updateDecor(session){
		await this.updateDecor(this.adapter._getSessionData(session))
	}

	//TODO: Is this really useful? Either store the decor or update on the fly, but both?

	/**
	 * This method is meant to be overwritten. //TODO: is this usefull?
	 *
	 * @param 	{SessionData} sesion_data 
	 * @return 	{undefined}
	 */
	async updateDecor(session_data){
		throw new DocloopError("Endpoint.updateDecor() not implemented")
	}


	/**
	 * Checks if the provided Object points to the same external Resource as the endpoint's identifier.
	 * 
	 * @param  {Identifier|DocloopEndpoint|EndpointSkeleton}			test	And identifier or any instance of DocloopEndpoint or a class that extends DocloopEndpoint or an EndpointSkeleton. 
	 * 
	 * @return {boolean}														True iff endpoint_or_identifier and the current endpoint point have the same external resource.
	 */
	match(test){

		var skeleton		=	(test.id && test.adapter) && test,
			test_identifier = 	(test && test.identifier) || test

		if(!skeleton && !test_identifier) throw new DocloopError('Endpoint.match() missing test identifier/endpoint/skeleton')

		if(skeleton && skeleton.id == this.id && skeleton.adapter == this.adapter.id) return true

		return 	[].concat(
					Object.keys(this.identifier),
					Object.keys(test_identifier)
				)
				.every( key => this.identifier[key] == test_identifier[key])
	}



}




module.exports = DocloopEndpoint