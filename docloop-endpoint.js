'use strict'


const	DocloopAdapter	=	require('./docloop-adapter.js'),
		DocloopError		=	 require('./docloop-error-handling.js').DocloopError



/**
 * An endpoint class is either {@link DocloopEndpoint} or any class extending it.
 * @typedef	EndpointClass
 */


/**
 * An endpoint is an instance of either {@link DocloopEndpoint} or any class extending it.
 * @typedef	Endpoint
 */


/**
 * A valid endpoint is an endpoint that passes .validate() for the current session.
 * Iff an endpoint is considered valid for a session, all links associated with this endpoint can be modified during this session.
 * @typedef {DocloopEndpoint} ValidEndpoint
 */


/**
 * TODO!
 * @typedef {Annotation}
 */

/**
 * TODO!
 * @typedef {Reply}
 */


/**
 * Identifiers describe external resources to be used by an adapter. 
 * They will always have at least the adapter property and the external resource should be uniquely determined by the remaining properties. 
 * Two Endpoints can have euqal identifiers, if for example they are part of two different Links.
 * 
 * @typedef {Object} Identifier
 * @property {string} adapter	An adapter id.
 * @property {...*}				Any other properties.
 */

/**
 * A Decoration object stores all the data the client need in order to visualize the resource pointed to by an identfier.
 * 
 * @typedef 	{Object} Decoration	
 * @property	{String} image 		Url of an image
 * @property 	{String} title 		Title of the resource, the identifier points to
 * @property	{String} details	Additonal information concerning the resource, the identfier points to
 */

/**
 * This is the base class for all endpoints, sources and targets alike. Any source or target should extend DocloopEndpoint.
 * 
 * @memberof 	module:Docloop
 * @param 		{DocloopAdapter} 	adapter 		
 * @param 		{Object} 			data 
 * @param 		{String|bson} 		data.id		 		Sets id property
 * @param 		{String|bson} 		data._id 			Sets id property. If .id is also given ._id will be ignored
 * @param 		{Identifier} 		data.identifier 	Sets identifier property
 * @param 		{Decoration} 		data.decor			Sets decor property
 * @param 		{Object} 			data.config 		Sets config property
 * @property	{bson}				id					
 * @property	{DocloopAdapter}	adapter				The adapter an endpoint is associated with 
 * @property 	{Identifier} 		identifier			Uniquely identifies an external resource
 * @property 	{config} 			config				Configuration data
 * @property	{defaultConfig}		defaultConfig		Configuration defaults
 * @property	{Decoration}		decor				Extra data for the client for visualization
 */
class DocloopEndpoint {

	constructor(adapter, {id, _id, identifier, config, decor}){

		if(!adapter)										throw ReferenceError("Endpoint.constructor() missing adapter")
		if(!identifier)										throw ReferenceError("Endpoint.constructor() missing identifier")
		if(adapter.id != identifier.adapter)				throw Error("Endpoint.constructor adapter/identifier mismatch")

		this.id				=	id || _id
		this.adapter 		= 	adapter
		this.identifier		= 	identifier
		this.config			= 	config || this.defaultConfig || {}

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
	 * @param  	{string}				str				A string from which to guess the Endpoint identifier
	 * @param  	{Object}				session_data	Data of the current session associated with this adapter
	 * @return 	{ValidEndpoint}
	 *
	 * @throw	{DocloopError}				If no valid endpoint can be guessed.
	 */
	static async guess(){
		throw new DocloopError("Endpoint.guess() not implemented for this adapter: "+ this.adapter.id)
	}

	/**
	 * Extracts raw data from the endpoint. (The same data will be used to save the endpoint to the database.)
	 * @type {{Identfífier: identifier, Decoration: decor, Object: config}}
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
	 * @typedef 	{Object}	EndpointSkeleton
	 * @property 	{bson} 		id 			Endpoint id
	 * @property 	{String}	adapter		Adapter id
	 */

	/**
	 * Extracts minimal data to find endpoint in the database.
	 * @type {EndpointSkeleton}
	 */
	get skeleton(){
		return {
			id:			this.id,
			adapter: 	this.identifier.adapter
		}
	}

	//TODO: Errors?

	/**
	 * Stores the endpoint to the database as new document. (Using the data from .export())
	 * @async
	 * @return {bson}	The mongo-db id for the inserted document.
	 */
	async store(){
		var result = await this.adapter.endpoints.insertOne(this.export)

		return this.id = result.insertedId
	}


	//TODO: Maybe refuse to update identifiers, force delete/recreate

	/**
	 * Updates document asociated with the endpoint using the data from .export().
	 * @return 	{undefined}
	 * @throws	{ReferenceError}	If this.id is undefined (i.e. the endpoint has not been stored yet)
	 */
	async update(){
		if(!this.id) throw ReferenceError

		var result 	= 	await this.adapter.endpoints.update(
							{_id: 	this.id},
							{ $set: this.export}
						)


		//TODO; nModified ==0 if nothing has changed, send different Error
		// This is not an error: updating a link can be okay if only the target has changes:
		//if(!result.nModified == 0) throw new Error("Endpoint.update(): no changes "+ result)
		if(!result.nMatched  == 0) throw new Error("Endpoint.update(): not found "+ result)

		if(result.writeError) 			throw new Eroor("Endpoint.update(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Eroor("Endpoint.update(); write concern error: "+result.writeConcernError)
	}

	/**
	 * Stores arbitrary data alongside the endpoint document.
	 * @async
	 * @param {String}					key		A key to store the data at.
	 * @param {Object|String|Number}	data 	The data to be stored at the key.
	 * @returns {undefined} 	
	 */
	async setData(key, data){
		var result 	= 	await this.adapter.endpoints.update(
							{_id: 	this.id},
							{ $set: {['data.'+key]: data}}
						)

		console.log(key, data, typeof data)

		//TODO; nModified ==0 if nothing has changed, send different Error
		// This is not an error: updating a link can be okay if only the target has changes:
		//if(!result.nModified == 0) throw new Error("Endpoint.update(): no changes "+ result)
		if(!result.nMatched  == 0) throw new Error("Endpoint.setData(): not found "+ result)

		if(result.writeError) 			throw new Eroor("Endpoint.setData(); write error: "+result.writeError)
		if(result.writeConcernError) 	throw new Eroor("Endpoint.setData(); write concern error: "+result.writeConcernError)
	}


	/**
	 * Retrieves data stored alongside the endpoint document.
	 * @async
	 * @param  {String}					key		The key, where the data is stored at.
	 * @return {Object|String|Number}			Data stored at the key.
	 */
	async getData(key){
		key = 'data.'+key

		var  data = await this.adapter.endpoints.findOne({_id: this.id})

		return key.split('.').reduce( (r, part) => r && r[part], data)

	}

	/**
	 * Removes te endpoint document from the database.
	 * @async
	 * @return {undefined}
	 */
	async remove(){
		if(!this.id) throw new Error("Endpoint.remove() missing id")

		var deletetion = await this.adapter.endpoints.deleteOne({_id:  this.id})

		if(deletetion.result.n != 1) throw new Error("Endpoint.remove() db failed to remove endpoint")
	}

	//TODO: use _validate!

	/**
	 * Calls {@link DocloopEndpoint#validate} with {@link SessionData}
	 * @async
	 * @param  {Object}		session
	 * @return {undefined}
	 */
	async _validate(session){
		await this.validate(this.adapter._getSessionData(session))
	}

	async validate(session_data){
	/**
	 * Checks if the current session has access to the resource pointed at by the endpoint's identifier. Whenever an endpoint passes .validate() 
	 * the endpoint and any link using this endpoint can be modified during this session.
	 * @async
	 * @param  {SessionData}		
	 * @return {undefined}
	 */
		throw new Error("Endpoint.validate() not implemented for this adapter: "+this.adapter.id)
	}

	//TODO: Is this really useful? Either store the decor or update on the fly, but both?

	/**
	 * TODO
	 * @return {undefined}
	 */
	async updateDecor(){
		throw new Error("Endpoint.updateDecor() not implemented")
	}


	/**
	 * Checks if the provided Object points to the same external Resource as the endpointÄs identifier.
	 * @param  {Identifier|DocloopEndpoint}		endpoint_or_identifier	And identifier or any instance of DocloopEndpoint or a class that extends DocloopEndpoint. 
	 * @return {boolean}												True if endpoint_or_identifier and the current endpoint point to the same external resource.
	 */
	match(endpoint_or_identifier){
		var test_identifier = 	endpoint_or_identifier.identifier || endpoint_or_identifier

		if(!test_identifier) throw new Error('Endpoint.match() missing test identifier')

		return 	[].concat(
					Object.keys(this.identifier),
					Object.keys(test_identifier)
				)
				.every( key => this.identifier[key] == test_identifier[key])
	}



}




module.exports = DocloopEndpoint