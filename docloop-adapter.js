'use strict'

var	EventEmitter 		= 	require('events'),
	Promise				= 	require('bluebird'),
	ObjectId 			= 	require('mongodb').ObjectID,
	express 			= 	require('express'),
	Target				=	require('./docloop-endpoint.js').Target,
	Endpoint			=	require('./docloop-endpoint.js'),
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
 * TODO: more
 * @memberof 	module:Docloop
 * @extends		EventEmitter
 * @param 		{DocloopCore} 		core 									An instance of the docloop core. 
 * @param		{Object}			config
 * @param		{String}			config.id								The id this adapter should be identified by (e.g. 'github').	
 * @param		{String}			[config.extraId]						TODO: This maybe useful if a custom adapter has fixed id, but is supposed to be instantiated twice.
 * @param		{String}			config.name								A pretty name for the Adapter, that can actually be used in a client.
 * @param		{String}			config.type								Either 'source' or 'target'.
 * @param		{DocloopEndpoint}	[config.endPointClass=DocloopEndpoint]	Endpoint class or any class extending Endpoint.
 * @param		{boolean}			[config.extraEndpoints=false]			True iff there are valid endpoints that are not returned by .getEndpoints()
 * @param		{Object}			[config.endpointDefaultConfig = {}]		Configuration object with default values for endpoints. These values will be used if no other values are provided when a new enpoint is created.
 * @param		{boolean}			config.extraEndpoints					true iff there are valid endpoints that are not returned by .getEndpoints()
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
	//TODO: Endpoint class into cinstructor

	//TODO: DO not store decoration
	//custom getDecoration function needed

	//TODO: endpointDefaultConfig into Endpoint


	constructor(core, config){

		if(!config)							throw new ReferenceError("docLoopAdapter.constructor() missing config")
		if(typeof config.id != 'string')	throw new TypeError("docLoopAdapter.constructor() invalid or missing config.id; config.id must be a string, got: "+ (typeof config.id) )

		super()

		this.core 					= core
		this.id						= config.id + (config.extraId ? '-' + config.extraId :'')
		this.name					= config.name
		this.type					= config.type
		this.endpointClass			= config.endpointClass || Endpoint
		this.extraEndpoints 		= !!config.extraEndpoints
		this.endpointDefaultConfig	= config.endpointDefaultConfig || {}
		this.app					= express()

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
	 * @param  {Object}				session		Express session
	 * @return {Object}							Adapter's session data
	 */
	_getSessionData(session){
		if(!session) 								throw new ReferenceError("DocloopAdapter._getSessionData() missing session")
		if(!session.constructor.name == "Session") 	throw new TypeError("DocloopAdapter._getSessionData() session must be instance of Session; got: "+session.constructor.name)

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= session.adapters[this.id]	|| {}

		return session.adapters[this.id]
	}

	/**
	 * Clears the data associated with this adapter in the provided session object. Returns an empty object. Modifying its values will modify the session.
	 * @param  {Object}				session		Express session
	 * @return {Object}							Empty session data
	 */
	_clearSessionData(session){
		if(!session) return null

		session.adapters 			= session.adapters 			|| {}
		session.adapters[this.id]	= {}

		return session.adapters[this.id]
	}

	//TODO: user logger?

	/**
	 * Calls .getEndpoints() with session data (see ...) and ignores errors. If any errors occur, an empty array will be returned.
	 * @param  {Object}				session		Express session
	 * @return {DocloopEndpoint[]}				
	 */
	async _getEndpoints(session){
		return await this.getEndpoints(this._getSessionData(session)).catch( e => console.error(e) || [])
	}

	/**
	 * Calls .getStoredEndpoints with session data (see ...) and ignores errors. If any errors occur, an empty array will be returned.
	 * @param  {Object}				session		Express session
	 * @return {DocloopEndpoint[]}
	 */
	async _getStoredEndpoints(session){
		return await this.getStoredEndpoints(this._getSessionData(session)).catch( e => console.error(e) || [])
	}

	/**
	 * Calls .getAuthState() with session data (see ...).
	 * @param  {Object}				session		Express session
	 * @return {Object}
	 */
	async _getAuthState(session){
		return this.getAuthState(this._getSessionData(session))
	}



	/**
	 * Collects adapter data for client use. 
	 * @param  {Object}				session		Express session
	 * @return {AdapterData}
	 */
	async _getData(session){
		return Promise.props({
			id:						this.id,
			name:					this.name,
			type:					this.type,
			extraEndpoints:			this.extraEndpoints,
			endpointDefaultConfig:	this.endpointDefaultConfig,
			auth:					this._getAuthState(session)
		})
	}
	/**
	 * Data concerning an adapter meant for client use. 
	 * @typedef 	{Object}			AdapterData
	 * @property 	{String} 			id 						The adapter's id
	 * @property 	{String}			name 					The adapter's name
	 * @property 	{boolean} 			extraEndpoints			The adapter's .extraEndpoints value
	 * @property	{Object}			endpointDefaultConfig	The adapter's .endpointDefaultConfig'value
	 * @property 	{AuthState} 		auth					The adapters authorization state. (see ...)
	 */


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
		var input	= req.params.str

		if(!input) throw new DocloopError("Missing input", 400)

		var endpoint = await this.endpointClass.guess(this, input, req.session)

		res.status(200).send(endpoint.export)
	}


	//TODO: check authorization (done):
	//TODO: check if this is uses anywhere

	/**
	 * Returns the endpoint with the provided id. Throws an error if it cannot be found or the session lacks privileges to acces it.
	 * @async
	 * @param  	{string | bson}				id			Mongo-db id
	 * @param 	{Object} 					session 	Express session
	 * @throws 	{DocloopError} 							If the endpoint cannot be found.
	 * @throws 	{DocloopError} 							If the endpoint cannot be validated for the session.
	 * @return 	{ValidEndpoint}
	 */
	async getStoredEndpoint(id, session){
		if(!id) throw new ReferenceError("DocloopAdapter.getStoredEndpoint() missing id")
		if(id._bsontype != 'ObjectId') id = ObjectId(id)

		var endpoint_data = await this.endpoints.findOne({'_id': id})
	
		if(!endpoint_data) throw new DocloopError("DocloopAdapter.getStoredEndpoint() unable to find Endpoint", 404)

		var endpoint = this.newEndpoint(endpoint_data)

		await endpoint.validate(session)

		return endpoint
	}


	/**
	 * Creates a new instance of the endpoint class associated with this adapter. The new endpoint's adapter will be set to this adapter.
	 * @param  {Object}				data		Data to instantiate the endpoint with.
	 * @return {DocloopEndpoint}				Endpoint
	 */
	newEndpoint(data){
		return new this.endpointClass(this, data)
	}

	/**
	 * This method is meant to be overwritten by a custom adapter class. Returns valid endpoints the current session has privileged access to.
	 * @async
	 * @abstract
	 * @param  {Object}					session_data	Data of the current session associated with this adapter 				
	 * @return {ValidEndpoint[]}		
	 */
	async getEndpoints(session_data){
		throw new DocloopError("DocloopAdapter.getEndpoints not implemented for this adapter: "+this.id)
	}


	/**
	 * This method is meant to be overwritten by a custom adapter class. Retuns all endpoints stored in the db, that are also valid for the current session.
	 * @async
	 * @abstract
	 * @return {ValidEndpoint[]}
	 */
	async getStoredEndpoints(){
		throw new DocloopError("DocloopAdapter.getStoredEndpoints not implemented for this adapter: "+this.id)
	}


	/**
	 * Authorization data for client use. A truthy user value indicated that the session user is logged in with a third party service.
	 * @typedef 	{Object} 	AuthState
	 * @property	{String} 	user?			The username, login or id of the service the adapter makes use of
	 * @property 	{String} 	link?			Authorization Url. This is the url the client is supposed to open in order to login with the service this adapters want to make use of. Make sure to also add a route to the adapters sub app in order to catch the callback or webhook or wahever your service calls after the authorization.
	 */

	
	/**
	 * This method is meant to be overwritten by a custom adapter class. Returns the authorization state for the adapter in the current session.
	 * @async
	 * @abstract
	 * @param  {Object}					session_data	Data of the current session associated with this adapter 									
	 * @return {AuthState}
	 */
	async getAuthState(session_data){
		return {
			url:	null,
			user:	null
		}
	}

}

module.exports = DocloopAdapter