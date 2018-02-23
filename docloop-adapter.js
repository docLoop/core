'use strict'

var	EventEmitter 		= 	require('events'),
	Promise				= 	require('bluebird'),
	ObjectId 			= 	require('mongodb').ObjectID,
	express 			= 	require('express'),
	DocloopEndpoint		=	require('./docloop-endpoint.js').DocloopEndpoint,
	DocloopError		= 	require('./docloop-error-handling.js').DocloopError,
	errorHandler		= 	require('./docloop-error-handling.js').errorHandler,
	catchAsyncErrors	= 	require('./docloop-error-handling.js').catchAsyncErrors




/**
 * Every adapter has its own reserved part of the express session object to store data in. SessionData refers to that part.
 * Modifying SessionData will modify the session. Whenever SessionData is mentioned, it is assumed that there is an adapter it belongs to. 
 * If you come across the real express session object you can access the adapter's reserved session part by calling {@link DocloopAdapter#getSessionData}.
 * The core and the base classes for adapters, links and endpoints use wrappers for some of the member methods to replace the original express session object with 
 * the adapters SessionData, in order to separate the data each adapter has access to. Wrapped methods are prefixed with an underscore _.
 * @typedef {SessionData}
 */


/**
 * This Class and any Class that extends DocloopAdapter are supposed to be passed to DocloopCore.use().
 * 
 * All methods that start with an underscore '_' expect the actual session to be passed as argument and will 
 * usually have a counterpart without the leading underscore that expects the adapter's session data as argument instead.
 * 
 * The preferred way for an adapter to communicate with the core system or other adapters is through events. See {@link module:docloop.DocloopCore#relayEvent}.
 *
 * 
 * @memberof 	module:docloop
 * @extends		EventEmitter
 * 
 * @param 		{DocloopCore} 		core 									An instance of the docloop core. 
 * @param		{Object}			config
 * @param		{String}			config.id								The id this adapter should be identified by (e.g. 'github').	
 * @param		{String}			[config.extraId]						This maybe useful if a custom adapter has a fixed id, but is supposed to be instantiated twice with different configs.
 * @param		{String}			[config.name='DocloopAdapter']			A pretty name for the Adapter, that can actually be used in a client.
 * @param		{String}			config.type								Either 'source' or 'target'.
 * @param		{DocloopEndpoint}	[config.endPointClass=DocloopEndpoint]	Endpoint class or any class extending Endpoint.
 * @param		{boolean}			[config.extraEndpoints=false]			True iff there are valid endpoints that are not returned by .getEndpoints()
 * @param		{Object}			[config.endpointDefaultConfig = {}]		Configuration object with default values for endpoints. These values will be used if no other values are provided when a new enpoint is created.
 * @param		{boolean}			config.extraEndpoints					true iff there are valid endpoints that are not returned by .getEndpoints()
 * 
 * @property 	{DocloopCore} 		core 
 * @property 	{String} 			id 
 * @property 	{String}			name 
 * @property 	{String}			type 
 * @property 	{DocloopEndpoint} 	endPointClass 
 * @property 	{Object} 			endpointDefaultConfig
 * @property 	{ExpressApp} 		app										Express sub app of core.app. All routes will be relative to '/adapters/'+this.id.
 * @propetty	{Promise}			ready									Promise that resolves when core and adapter are fully set up.
 * @property 	{Collection} 		endpoints								Mongo-db collection for stored endpoints.
 */
class DocloopAdapter extends EventEmitter {


	//Todo, put EventQueue config into adapter config
	//TODO: Endpoint class into constructor

	//TODO: DO not store decoration
	//custom getDecoration function needed

	//TODO: endpointDefaultConfig into Endpoint


	constructor(core, config){

		if(core === undefined)				throw new ReferenceError("DocloopAdapter.constructor() missing core")				
		if(core.constructor.name != 'DocloopCore')	
											throw new TypeError("DocloopAdapter.constructor() core must be an instance of DocloopCore.")

		if(!config)							throw new ReferenceError("DocloopAdapter.constructor() missing config")
		
		if(config.id === undefined)			throw new ReferenceError("DocloopAdapter.constructor() missin config.id")
		if(typeof config.id != 'string')	throw new TypeError("DocloopAdapter.constructor() config.id must be a string, got: "+ (typeof config.id) )

		if(config.extraId && typeof config.extraId != 'string')
											throw new TypeError("DocloopAdapter.constructor() config.extraId must be a string")

		if(config.name && typeof config.name != 'string')
											throw new TypeError("DocloopAdapter.constructor() config.name must be a string")

		if(config.type === undefined)		throw new ReferenceError("DocloopAdapter.constructor() missing config.type")
		if(['source', 'target'].indexOf(config.type.toLowerCase()) == -1)	
											throw new RangeError("DocloopAdapter.constructor()config.type must be either 'source' or 'target'; got "+config.type)

		if(['source', 'target'].indexOf(config.type) == -1)
											throw new RangeError("DocloopAdapter.constructor() type must be either 'source' or 'target', got: "+config.type)


		if(config.extraEndpoints !== undefined && typeof config.extraEndpoints != 'boolean')
											throw new TypeError("DocloopAdapter.constructor() config.extraEndpoints must be a boolean")


		if(config.endpointDefaultConfig && typeof config.endpointDefaultConfig != 'object')
											throw new TypeError("DocloopAdapter.constructor() config.endpointDefaultConfig must be an object")								

		if(config.endpointClass === undefined)			
											throw new ReferenceError("DocloopAdapter.constructor() missing config.endpointClass")

		if(typeof config.endpointClass != 'function')
											throw new TypeError("DocloopAdapter.constructor() config.endpointClass must be an instance of function; got: "+(typeof config.endpointClass))



		super()

		this.core 					= core
		this.id						= config.id + (config.extraId ? '-' + config.extraId :'')
		this.name					= config.name || 'DocloopAdapter'
		this.type					= config.type.toLowerCase()
		this.endpointClass			= config.endpointClass || DocloopEndpoint
		this.extraEndpoints 		= !!config.extraEndpoints
		this.endpointDefaultConfig	= config.endpointDefaultConfig || {}
		this.app					= express()


		this.setMaxListeners(50)

		this.ready = 	this.core.ready
						.then( ()  => {
							this.endpoints 	= this.core.db.collection(this.id+'_endpoints')

							this.core.app.use('/adapters/'+this.id, this.app)
							
							this.app.get('/', 					catchAsyncErrors(this._handleGetRequest.bind(this) ))

							this.app.get('/endpoints',			catchAsyncErrors(this._handleGetEndpointsRequest.bind(this) ))

							this.app.get('/guessEndpoint/:str',	catchAsyncErrors(this._handleGetGuessEndpointRequest.bind(this) ))
						})

	}

	/**
	 * Extracts the data associated with this adapter in the provided session object. Modifying its values will modify the session.
	 * 
	 * @param  {Session}			session		Express session
	 * 
	 * @return {Object}							Adapter's session data
	 */
	_getSessionData(session){
		if(session === undefined)					throw new ReferenceError("DocloopAdapter._getSessionData() missing session")
		if(session.constructor.name != "Session") 	throw new TypeError("DocloopAdapter._getSessionData() session must be instance of Session; got: "+session.constructor.name)

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= session.adapters[this.id]	|| {}

		return session.adapters[this.id]
	}

	/**
	 * Clears the data associated with this adapter in the provided session object. Returns an empty object. Modifying its values will modify the session.
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {Object}							Empty session data
	 */
	_clearSessionData(session){
		if(session === undefined)					throw new ReferenceError("DocloopAdapter._getSessionData() missing session")
		if(session.constructor.name != "Session") 	throw new TypeError("DocloopAdapter._getSessionData() session must be instance of Session; got: "+session.constructor.name)


		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= {}

		return session.adapters[this.id]
	}

	//TODO: user logger?




	/**
	 * Calls .getEndpoints() with {@link sessionData}.
	 *
	 * @async
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {DocloopEndpoint[]}				
	 */
	async _getEndpoints(session){
		return await this.getEndpoints(this._getSessionData(session))
	}


	/**
	 * Calls .getEndpoint() with {@link sessionData}.
	 *
	 * @async
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {DocloopEndpoint[]}				
	 */
	async _getStoredEndpoint(session){
		return await this.getStoredEndpoint(this._getSessionData(session))
	}



	/**
	 * Calls .getStoredEndpoints with {@link sessionData}.
	 *
	 * @async
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {DocloopEndpoint[]}
	 */
	async _getStoredEndpoints(session){
		return await this.getStoredEndpoints(this._getSessionData(session))
	}

	/**
	 * Calls .getAuthState() with {@link sessionData}.
	 * 
	 * @async
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {Object}
	 */
	async _getAuthState(session){
		return await this.getAuthState(this._getSessionData(session))
	}




	/**
	 * Data concerning an adapter meant for client use. 
	 * 
	 * @typedef 	{Object}			AdapterData
	 * @memberof	module:docloop.DocloopAdapter
	 * 
	 * @property 	{String} 			id 						The adapter's id
	 * @property 	{String}			name 					The adapter's name
	 * @property 	{String}			type 					The adapter's type
	 * @property 	{boolean} 			extraEndpoints			The adapter's .extraEndpoints value
	 * @property	{Object}			endpointDefaultConfig	The adapter's .endpointDefaultConfig'value
	 * @property 	{AuthState} 		auth					The adapters authorization state. (see ...)
	 */




	/**
	 * Collects adapter data for client use. 
	 * 
	 * @async
	 * 
	 * @param  {Session}				session		Express session
	 * 
	 * @return {AdapterData}
	 */
	async _getData(session){
		if(session === undefined)					throw new ReferenceError("DocloopAdapter._getSessionData() missing session")
		if(session.constructor.name != "Session") 	throw new TypeError("DocloopAdapter._getSessionData() session must be instance of Session; got: "+session.constructor.name)


		return {
			id:						this.id,
			name:					this.name,
			type:					this.type,
			extraEndpoints:			this.extraEndpoints,
			endpointDefaultConfig:	this.endpointDefaultConfig,
			auth:					await this._getAuthState(session).catch(() => ({ user:null, link:null }))
		}
	}





	/**
	 * Express request handler. Sends AdapterData to the client.
	 */
	async _handleGetRequest(req, res){
		var data = await this._getData(req.session)

		res.status(200).send(data)
	}



	/**
	 * Express request handler. Sends privileged Enpoints to the client.
	 */
	async _handleGetEndpointsRequest(req, res){
		var endpoints = await this._getEndpoints(req.session)

		res.status(200).send(endpoints.map( endpoint => endpoint.export ))
	}


	/**
	 * Express request handler. Guesses Endpoint from request paramter and sends it to the client.
	 */
	async _handleGetGuessEndpointRequest(req,res){
		var input	= req && req.params && req.params.str

		if(!input) throw new DocloopError("DocloopAdapter._handleGetGuessEndpointRequets() missing params.str", 400)

		var endpoint = await this.endpointClass.guess(this, input, req.session)

		res.status(200).send(endpoint.export)
	}


	//TODO: check authorization (done):
	//TODO: check if this is uses anywhere
	//
	//TOSDO: _getStoredEndpoints(id, session_data)

	/**
	 * Returns the endpoint with the provided id. Throws an error if it cannot be found or the session lacks privileges to access it.
	 * 
	 * @async
	 * 
	 * @param  	{string | bson}				id			Mongo-db id
	 * @param 	{Object} 					session 	Express session
	 * 
	 * @throws 	{DocloopError} 							If the endpoint cannot be found.
	 * @throws 	{DocloopError} 							If the endpoint cannot be validated for the session.
	 * 
	 * @return 	{ValidEndpoint}
	 */
	async getStoredEndpoint(id, session_data){
		if(!id) throw new ReferenceError("DocloopAdapter.getStoredEndpoint() missing id")
		if(id._bsontype != 'ObjectID') id = ObjectId(id)

		var endpoint_data = await this.endpoints.findOne({'_id': id})
	
		if(!endpoint_data) throw new DocloopError("DocloopAdapter.getStoredEndpoint() unable to find Endpoint", 404)

		var endpoint = this.newEndpoint(endpoint_data)

		await endpoint.validate(session_data)

		return endpoint
	}


	/**
	 * Creates a new instance of the endpoint class associated with this adapter. The new endpoint's adapter will be set to this adapter.
	 * 
	 * @param  {Object}				data		Data to instantiate the endpoint with.
	 * 
	 * @return {DocloopEndpoint}				Endpoint
	 */
	newEndpoint(data){
		return new this.endpointClass(this, data)
	}

	/**
	 * This method is meant to be overwritten by a custom adapter class. Returns valid endpoints the current session has privileged access to.
	 * @async
	 * 
	 * @abstract
	 * 
	 * @param  {Object}					session_data	Data of the current session associated with this adapter 				
	 * 
	 * @return {ValidEndpoint[]}		
	 */
	async getEndpoints(session_data){
		throw new DocloopError("DocloopAdapter.getEndpoints not implemented for this adapter: "+this.id)
	}


	/**
	 * This method is meant to be overwritten by a custom adapter class. Retuns all endpoints stored in the db, that are also valid for the current session.
	 * 
	 * @async
	 * 
	 * @abstract
	 * 
	 * @return {ValidEndpoint[]}
	 */
	async getStoredEndpoints(session_data){
		throw new DocloopError("DocloopAdapter.getStoredEndpoints not implemented for this adapter: "+this.id)
	}


	/**
	 * Authorization data for client use. A truthy user value indicated that the session user is logged in with a third party service.
	 * @typedef 	{Object} 	AuthState
	 * 
	 * @property	{String} 	[user=null]			The username, login or id of the service the adapter makes use of
	 * @property 	{String} 	[link=null]			Authorization Url. This is the url the client is supposed to open in order to login with the service this adapters want to make use of. Make sure to also add a route to the adapters sub app in order to catch the callback or webhook or wahever your service calls after the authorization.
	 */

	
	/**
	 * This method is meant to be overwritten by a custom adapter class. Returns the authorization state for the adapter in the current session.
	 * 
	 * @async
	 * 
	 * @abstract
	 * 
	 * @param  {Object}					session_data	Data of the current session associated with this adapter 									
	 * 
	 * @return {AuthState}
	 */
	async getAuthState(session_data){
		throw new DocloopError("DocloopAdapter.getAuthState not implemented for this adapter: "+this.id)
	}

}

module.exports = DocloopAdapter





/**
 * Either {@link module:docloop.DocloopAdapter DocloopAdapter} or any Class extending it. 
 * 
 * @typedef {Class} AdapterClass
 * @memberof	module:docloop.DocloopAdapter
 */

/**
 * An instance of either {@link module:docloop.DocloopAdapter DocloopAdapter} or any Class extending it. 
 * 
 * @typedef {Object} Adapter
 * @memberof	module:docloop.DocloopAdapter
 */