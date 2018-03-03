'use strict'

/**
 * @event 		link-established
 * @memberof	DocloopCore
 * @type		{LinkSkeleton}
 */

/**
 * @event 		link-removed
 * @memberof	DocloopCore
 * @type		{LinkSkeleton}
 */

/**
 * @event 		link-updated
 * @memberof	DocloopCore
 * @type		{LinkSkeleton}
 */


/**
 * @typedef {Object} Collection
 * TODO: get own collections from adapter (???)
 */


const 	EventEmitter 	= require('events'),
		DocloopLink		= require('./docloop-link.js'),
		DocloopError	= require('./docloop-error-handling.js').DocloopError,
		DocloopAdapter	= require('./docloop-adapter.js'),
		errorHandler	= require('./docloop-error-handling.js').errorHandler,
		catchAsyncErrors= require('./docloop-error-handling.js').catchAsyncErrors,
		express 		= require('express'),
		MongoClient 	= require('mongodb').MongoClient,
		session 		= require('express-session'),
		MongoStore 		= require('connect-mongo')(session),
		bodyParser 		= require('body-parser'),
		Promise			= require('bluebird'),
		ObjectId 		= require('mongodb').ObjectID




/**
 * The Docloop  core system. An instance of this class is used to setup the application and will also be passed to all adapters as core.
 *
 * All events emitted by the adapters will be enhanced and reemmited on the core. See {@link DocloopCore#relayEvent}.
 * 
 * @memberof	module:docloop  
 *
 * @alias		DocloopCore
 * 
 * @param  		{Object} 				 config  
 * @param 		{String} 				[config.name = Docloop]		Readable name for frontend output or to distinguish different instances of docloop.
 * @param 		{Number} 				 config.port				The port the app  will respond to.
 * @param 		{String} 				[config.home]				Project website
 * @param 		{String} 				[config.clientUrl = /]		The url of the client. Some adapters will need this to redirect the user back to the client after some extenal authentication.
 * @param 		{String} 				 config.sessionSecret:		Your session secret, used in express session config.
 * @param 		{Object} 				 config.db					Database configuration	
 * @param 		{String} 				 config.db.address			mongo-db address
 * @param 		{String} 				 config.db.name				mongo-db name
 * @param 		{String} 				 config.db.port				mongo-db port
 * @param 		{String} 				[config.db.user]			mongo-db username
 * @param 		{String} 				[config.db.pass]			mongo-db password
 * 
 * @property 	{ExpressApp} 			 app 						The express app
 * @property 	{Object} 				 adapters 					Hash map of all used adapters. Adapters' ids are used as keys.
 * @property 	{Adapter[]} 			 sourceAdapters 			Array of all used source adapters
 * @property 	{Adapter[]} 			 targetAdapters 			Array of all used target adapters
 * @property	{Promise}				 ready						Resolves when this instance is fully set up
 * @property 	{String[]} 				 preventRelayEventNames		Events that should not be relayed
 * 
 * @emits		DocloopCore.link-established
 * @emits		DocloopCore.link-removed
 * @emits		DocloopCore.link-updated
 *
 */

class DocloopCore extends EventEmitter {






	constructor(config){


		var defaults =	{
							name:		'docloop',
							clientUrl:	'/'
						}

		super()

		if(config === undefined)						throw new ReferenceError	("DocloopCore.constructor() missing config")
		if(!config)										throw new TypeError			("DocloopCore.constructor() expecting config to be an object")

		for(var key in defaults) config[key] = config[key] || defaults[key] 

		if(typeof config.name != 'string')				throw new TypeError			("DocloopCore.constructor() expecting config.name to be a string, got: "+ (typeof config.name) )

		if(config.port === undefined) 					throw new ReferenceError	("DocloopCore.constructor() missing config.port")	
		if(typeof config.port != 'number') 				throw new TypeError			("DocloopCore.constructor() expecting config.port to be a number, got: "+(typeof config.port) )	


		if(config.sessionSecret === undefined) 			throw new ReferenceError	("DocloopCore.constructro() missing config.sessionSecret")	
		if(typeof config.sessionSecret != 'string') 	throw new TypeError			("DocloopCore.constructor() expecting config.sessionSecret to be a string, got: "+(typeof config.sessionSecret) )	


		if(config.db === undefined)						throw new ReferenceError	("DocloopCore.constructor() missing config.db")

		if(config.db.name === undefined) 				throw new ReferenceError	("DocloopCore.constructor() missing config.db.name")	
		if(typeof config.db.name != 'string') 			throw new TypeError			("DocloopCore.constructor() expecting config.db.name to be a string, got: "+(typeof config.db.name) )	

		if(config.db.port === undefined) 				throw new ReferenceError	("DocloopCore.constructor() missing config.db.port")	
		if(typeof config.db.port != 'number') 			throw new TypeError			("DocloopCore.constructor() expecting config.db.port to be a number, got: "+(typeof config.db.port) )	



		this.config		= 	config
		this.adapters 	= 	{}



		this.setMaxListeners(1000)


		// Database
		var connect_str	= ('mongodb://')
						+ (this.config.db.user || '')
						+ (this.config.db.user && this.config.db.pass ? ':' : '') 
						+ (this.config.db.pass || '')
						+ (this.config.db.user && '@' || '')
						+ (this.config.db.address || "127.0.0.1")
						+ (':')
						+ (this.config.db.port)
						+ ('/')
						+ (this.config.db.name)

		console.log('Connecting to: ', connect_str)

		this.ready 		= 	MongoClient.connect(connect_str)
							.then( client => {
								this.db 	= client.db(this.config.db.name)
								this.links 	= this.db.collection('links')
								return this.db
							})


		


		//Events

		this.preventRelayEventNames = [

			'newListener', 
			'removeListener', 

			'link-established',
			'link-removed',
			'link-updated'
		],


		//Ready:

		this.ready	 = 	this.ready
						.then( () => {

							this.app		= 	express()

							//Sessions								
							this.app.use(session({
								name:				'docloop.sid',
								secret:				config.sessionSecret,
								store:				new MongoStore( { db: this.db} ),
								resave:				false,
								saveUninitialized: 	true,
								cookie: 			{ 
														path: 		'/', 
														httpOnly: 	true,  //TODO!
														secure: 	'auto', 
														maxAge: 	null
													}
							}))


							this.app.use(function(req, res, next) {
								res.header('Access-Control-Allow-Credentials', 	true)
								res.header('Access-Control-Allow-Origin', 		req.headers.origin)
								res.header('Access-Control-Allow-Methods', 		'GET,PUT,POST,DELETE')
								res.header('Access-Control-Allow-Headers', 		'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept')
								next()		
							})

							//Routes


							this.app.use(bodyParser.json())
							this.app.use(express.static('public'))


							this.app.get(	'/', 				catchAsyncErrors(this.handleGetRootRequest.bind(this)))
							this.app.get(	'/links', 			catchAsyncErrors(this.handleGetLinksRequest.bind(this)))
							this.app.post(	'/links', 			catchAsyncErrors(this.handlePostLinkRequest.bind(this)))

							this.app.get(	'/links/:id', 		catchAsyncErrors(this.handleGetLinkRequest.bind(this)))


							this.app.put(	'/links/:id', 		catchAsyncErrors(this.handlePutLinkRequest.bind(this)))
							this.app.delete('/links/:id', 		catchAsyncErrors(this.handleDeleteLinkRequest.bind(this)))

							this.app.get(	'/adapters', 		catchAsyncErrors(this.handleGetAdaptersRequest.bind(this)))
							this.app.get(	'/dropSession', 	catchAsyncErrors(this.handleDropSessionRequest.bind(this)))


							//Errors:

							this.app.use(errorHandler)


						})
						.catch( e => {

							console.log(e.message)
							process.exit(1)

							//This prevents tests to go bonkers if process.exit is stubbed:
							throw Error("DocloopCore.constructor() should have exited already.")
						})


		//TODO: separate relay Events

		//TODO: All objects can be manifested as  id_data or data or full object 

		//TODO: Log Errors, resp. have core log errors, add ErrorEvent listener!

		//TODO: Get AuthorizedEndpoints

		//TODO: Separate events for annotation and reply!

		//TODO: separate adapters for sources and targets, only use endpoints

		//TODO: get abstract handle request


		//TODO: rethink validation and authentication: what makes a link valid? Who can delete it?

		//TODO: Only call underscore_ methods of adapters

	
		//TODO: When insatllation gets removed clear links
		//
		//TODO: handle AnnotationRemovalEvent
		//TODO  handle AnnotationChangeEvent
		

		//TODO: Relay auslagern
		

		//TODO: new-link event!

		//Use ErrorObjects

		//TODO: There should never be a public target!

		//TODO: In packages aufstpalten

		//TODO: Separate handle function for error handling

		//TODO: Error Handling -> Add DocloopError object



	}


	/**
	 * Will instantiate AdapterClass once with this as core and the provided configuration object. The new instance will be added to the list of adapters.
	 * 
	 * @async
	 * 
	 * @param  	{AdapterClass} 					
	 * @param  	{Object} 			config		The configuration object for the custom adapter class.
	 * 
	 * @return 	{} 								this for chaining
	 *
	 * @throws	{DocloopError|409}				If another adapter with the same id is already in use.
	 * 
	 */
	use(AdapterClass, config){

		if(AdapterClass === undefined)	throw new ReferenceError("DocloopCore.use() missing AdapterClass")

		console.log('###', AdapterClass.prototype.constructor.name, AdapterClass.prototype  instanceof DocloopAdapter)

		if(AdapterClass != DocloopAdapter && !(AdapterClass.prototype  instanceof DocloopAdapter) )
										throw new TypeError("Docloop.core.use() AdapterClass must equal to or extend DocloopAdapter")

		var adapter = new AdapterClass(this, config)


		if(this.adapters[adapter.id]) 	throw new DocloopError("DocloopCore.use() cannot register two adapters with the same id: " + adapter.id, 409)

		this.adapters[adapter.id] = adapter
		this.syncRelayListeners(adapter)		


		return this
	}

	/**
	 * Start the App and listen to the configured port.
	 * @return {Promise}
	 */
	async run(){	
		return this.ready
				.then( () => {
					console.log('docLoop running on port', this.config.port)
					console.log('db on port ' + this.config.db.port + ' ...')
					this.app.listen(this.config.port)
				})
	}

	/**
	 *Create new instance of {@link DocLoopLink} with this as core using the provided data.
	 * 
	 * @param 	{LinkData} 		data 	Configuration data for the new DocloopLink instance.
	 * @return 	{DocloopLink} 			
	 */
	newLink(data){
		return new DocloopLink(this, data)
	}

	get sourceAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'source')
	}

	get targetAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'target')
	}





	/**
	 * Get a strored link.
	 * 
	 * @param  	{string|bson}		mongo-db id 
	 * 
	 * @return 	{DocloopLink}
	 *
	 * @throws	{TypeError}							If id cannot be converted to ObjectId.
	 * @throws	{DocloopError|404}					If no link was found matching the id.
	 * @throws	{DocloopError}						If the stored link's source skeleton is missing or incomplete.
	 * @throws	{DocloopError}						If the stored link's target skeleton is missing or incomplete.
	 * @throws	{DocloopError}						If there is no registered adapter to match the source adapter.
	 * @throws	{DocloopError}						If there is no registered adapter to match the target adapter.
	 * @throws	{DocloopError}						If the source or target cannot be read from the respective collections.
	 */
	async getStoredLink(id){

		if(!id) throw ReferenceError("docLoopCore.getStoredLink() missing id")

		try 	{	if(id._bsontype != 'ObjectID') id = ObjectId(id) }
		catch(e){	throw new TypeError("docLoopCore.getStoredLink() unable to convert id to ObjectId: "+e.message) }



		var link_skeleton 		= 	await this.links.findOne({'_id': id})

		if(!link_skeleton)					throw new DocloopError("docLoopCore.getStoredLink() unable to find link in db", 404)

		if(!link_skeleton.source) 			throw new DocloopError("docLoopCore.getStoredLink() unable to read source from db")
		if(!link_skeleton.target) 			throw new DocloopError("docLoopCore.getStoredLink() unable to read target from db")

		if(!link_skeleton.source.adapter) 	throw new DocloopError("docLoopCore.getStoredLink() unable to read source.adapter from db")
		if(!link_skeleton.target.adapter) 	throw new DocloopError("docLoopCore.getStoredLink() unable to read target.adapter from db")

		if(!link_skeleton.source.id) 		throw new DocloopError("docLoopCore.getStoredLink() unable to read source.id from db")
		if(!link_skeleton.target.id) 		throw new DocloopError("docLoopCore.getStoredLink() unable to read target.id from db")

		var source_adapter 		= 	this.adapters[link_skeleton.source.adapter],
			target_adapter		= 	this.adapters[link_skeleton.target.adapter]

		if(!source_adapter)					throw new DocloopError("docLoopCore.getStoredLink() unable to find matching source adapter")	
		if(!target_adapter)					throw new DocloopError("docLoopCore.getStoredLink() unable to find matching target adapter")	

		var	[source, target] 	=  	await	Promise.all([
												source_adapter.getStoredEndpoint(link_skeleton.source.id),
												target_adapter.getStoredEndpoint(link_skeleton.target.id)
											])

		if(!source)							throw new DocloopError("docLoopCore.getStoredLink() unable to find matching source", 404)
		if(!target)							throw new DocloopError("docLoopCore.getStoredLink() unable to find matching target", 404)

		return this.newLink({id, source, target})
	}




	
	/**
	 * Setup event listeners such that every time an event fires on an adapter it gets relayed to the core via {@link DocloopCore#relayEvent}.
	 *
	 * @private
	 * 
	 * @param  	{Adapter}
	 * 
	 * @return 	undefined
	 *
	 * @listens	newListener
	 */
	syncRelayListeners(adapter) {

		if(adapter === undefined) throw new ReferenceError("DocloopCore.sanyRelayListeners() missing adapter")
		if(!(adapter instanceof DocloopAdapter)) throw new TypeError("DocloopCore.sanyRelayListeners() adapter must be instance of DocloopAdapter or a Class extending DocloopAdapter")

		var core_event_names_array  = this.eventNames().filter( event_name => this.preventRelayEventNames.indexOf(event_name) == -1)

		core_event_names_array.forEach( event_name => {
			adapter.on(event_name, this.relayEvent.bind(this, event_name) ) 
		})

		this.on('newListener', 	event_name => this.preventRelayEventNames.indexOf(event_name) == -1 && adapter.on(event_name, this.relayEvent.bind(this, event_name) ))
	}




	/**
	 * Relays an event if it has a source property. 
	 * For every Link with that source reemits the events on core replacing the source property with the link's target.
	 * This way one adapter can emit an event and everyother (linked) adapter can listen to it on the core.
	 * 
	 * @async
	 * 
	 * @param  {String}				event_name		The event name
	 * @param  {data}				data			Event data
	 * 
	 * @return undefined
	 *
	 * @throws	{ReferenceError}					If either source.id or source.adapter is missing.
	 */
	async relayEvent(event_name, data) {
		if(event_name === undefined)		throw new ReferenceError('DocloopCore.relayEvent() missing event_name')
		if(typeof event_name != 'string')	throw new TypeError('DocloopCore.relayEvent() event_name must be a string, got :'+(typeof event_name) )
		
		//If the event wasn't meant to be relayed:
		if(!data || !data.source)	return null

		var source 	= data.source

		delete data.source

		//If it was meant to be relayed but, crucial data is missing: 
		if(!source.id) 						throw new ReferenceError('DocloopCore.relayEvent()) missing source id')
		if(!source.adapter) 				throw new ReferenceError('DocloopCore.relayEvent()) missing source adapter')


		var links	= await this.links.find({source}).toArray()


		links
		.map( 		link 	=> link.target)
		.forEach( 	target 	=> this.emit(event_name, { ...data, target, relayed: true} ) )
	}



	/**
	 * Basic information about the running instance.
	 * 
	 * @typedef {AppData}
	 *
	 * @property {!string} 	name 		The name of the instance
	 * @property {!string}	version 	Docloop version
	 */

	/**
	 * Express request handler. Returns basic app information.
	 *
	 * @route	{GET}	/
	 * 
	 * @async
	 * 
	 * @param  	{Object}		req		Express request object
	 * @param  	{Object}		res		Express result object
	 *
	 * @return 	{AppData}				App information 
	 */

	async handleGetRootRequest(req, res){
		var data = 	{
						name:		this.config.name,
						version:	process.env.npm_package_version
					}

		res.status(200).send(data)
	}




	/**
	 * Express request handler. Destroys the current session.
	 *
	 * @route	{GET}		/dropsession
	 * 
	 * @async
	 * 
	 * @param  	{Object}		req		Express request object
	 * @param  	{Object}		res		Express result object
	 * 
	 * @return undefined
	 */
	async handleDropSessionRequest(req, res){
		req.session.destroy( err => {
			if(err) throw new DocloopError(err)
			res.status(200).send('Session dropped.')
		})
	}



	/**
	 * Express request handler. Get data for all adapters.
	 *
	 * @route	{GET}	/adapters
	 * 
	 * @async
	 * 
	 * @param  	{Object}		req		Express request object
	 * @param  	{Object}		res		Express result object
	 * 
	 * @return undefined
	 */
	async handleGetAdaptersRequest(req, res){
		var	adapters_array 	= 		Object.keys(this.adapters).map( id => this.adapters[id] ),
			adapters_data	= await	Promise.all( adapters_array.map( adapter => adapter._getData(req.session) ) )

		res.status(200).send(adapters_data)
	}






	/**
	 * Express request handler. Get data of a single link.
	 *
	 * @route {GET} /links/:id
	 * 
	 * @async
	 * 
	 * @param  {Object}		req				Express request object
	 * @param  {Object}		req.param		Request paramters
	 * @param  {Object}		req.param.id	Link id
	 * @param  {Object}		res				Express result object
	 * 
	 * @return undefined
	 */
	async handleGetLinkRequest(req, res){
		if(!req || !req.params || !req.params.id) throw new DocloopError("docLoopCore.handleGetLinkRequest() missing res.params.id", 400)

		var link = await this.getStoredLink(req.params.id) 

		res.status(200).send(link.export)
	}






	/**
	 * Express request handler. Gets data of all link accessible by the current session.
	 *
	 * @route	{GET}	/links		
	 * 
	 * @async
	 * 
	 * @param  	{Object}		req		Express request object
	 * @param  	{Object}		res		Express result object
	 * 
	 * @return undefined
	 */
	async handleGetLinksRequest(req, res){

		var sources			=	[].concat.apply([], await Promise.map(this.sourceAdapters, adapter => adapter._getStoredEndpoints(req.session).catch( () => [] ) ) ),
			targets			=	[].concat.apply([], await Promise.map(this.targetAdapters, adapter => adapter._getStoredEndpoints(req.session).catch( () => [] ) ) )


		if(sources.length == 0 && targets.length == 0) return res.status(200).send([])



		var	source_queries 	= 	sources.map( source => ({'source.id' : source.id, 'source.adapter': source.identifier.adapter}) ),
			target_queries 	= 	targets.map( target => ({'target.id' : target.id, 'target.adapter': target.identifier.adapter}) ),
			raw_links		=	await	this.links.find({
											$or: [].concat(source_queries, target_queries)
										}).toArray(),
			links			= 	await 	Promise.map(
											raw_links,
											async raw_link 	=> {
												var source = await this.adapters[raw_link.source.adapter]._getStoredEndpoint(raw_link.source.id, req.session),
													target = await this.adapters[raw_link.target.adapter]._getStoredEndpoint(raw_link.target.id, req.session)

												return 	this.newLink({ id: raw_link._id, source, target })
											}
										)
		links =	links.filter( link => !!link )

		await	Promise.map( 
					links,
					link	=> Promise.join(link.source._updateDecor(req.session), link.target._updateDecor(req.session)) 
				)						

				
		res.status(200).send(links.map( link => link.export ))

	}
	



	/**
	 * Express request handler. Removes a link.
	 *
	 * @route	{DELETE}	/link/:id
	 * 
	 * @async
	 * 
	 * @param  	{Object}	req				Express request object
	 * @param  	{Object}	req.params		Request paramteres
	 * @param  	{Object}	req.params.id	Link id
	 * @param  	{Object}	res				Express result object
	 *                          
	 * @returns undefined
	 */
	async handleDeleteLinkRequest(req, res){

		if(!req || ! req.params || !req.params.id) throw new DocloopError("docLoopCore.handleDeleteLinkRequest() missing req.param.id", 400)

		var link = await this.getStoredLink(req.params.id) 

		await link._validate(req.session)
		await link.remove()
		
		this.emit('link-removed', link.skeleton)

		res.status(200).send("link removed")
	}




	/**
	 * Express request handler. Creates a new link out of posted source and target, validates and stores the link.
	 *
	 * @route 		{POST} 		/links
	 * 
	 * @async
	 * 
	 * @param  		{Object} 			req						Express request object
	 * @param  		{Object} 			req.body				Request body
	 * @param		{EndpointData}		req.body.source			Source Data					
	 * @param		{EndpointData}		req.body.target			Target Data
	 * @param  		{Object} 			res						Express result object
	 * 
	 * @return 		undefined
	 * 
 	 * @emits		DocloopCore.link-established
 	 * 
	 * @throws		{DocloopError|400}				If source or target is missing
	 * @throws		{*}								If either source or target wont validate. See {@link DocloopLink._validate}.
	 * @throws		{*}								If there's already another link between the same source and target. See {@link DocloopLink.preventDuplicate}
	 * @throws		{DocloopError|500}				If link cannot be stored
	 */
	async handlePostLinkRequest(req, res){

		var source	= req && req.body && req.body.source,
			target	= req && req.body && req.body.target


		//TODO: throw errors:

		if(!source) 			throw new DocloopError("DocloopCore.handlePostLinkRequest() missing source", 400)
		if(!target) 			throw new DocloopError("DocloopCore.handlePostLinkRequest() missing target", 400)


		if(!source.identifier) 	throw new DocloopError("DocloopCore.handlePostLinkRequest() missing source identifier", 400)
		if(!target.identifier) 	throw new DocloopError("DocloopCore.handlePostLinkRequest() missing target identifier", 400)



		var link = await this.newLink({source, target})

		await link._validate(req.session)


		await link.preventDuplicate()
		await link.store()

		res.status(200).send(link.export)
		this.emit('link-established', link.skeleton)
	}


	//TODO: Maybe prevent changes of identifiers... only change config

	//This should be updateConfig!

	/**
	 * Express request handler. Updates an existing link. (Todo: should only update config)
	 *
	 * @route		{PUT}	/links/:id
	 *
	 * @async
	 * 
	 * @param  		{Object} 			req					Express request object
	 * @param  		{Object} 			req.params			Request paramters
	 * @param  		{Object} 			req.params.id		
	 * @param  		{Object} 			req.body			Request body
	 * @param  		{EndpointData} 		req.body.source		Sourcet data
	 * @param  		{EndpointData} 		req.body.target		Target data
	 * @param  		{Object} 			res					Express result object
	 * 
	 * 
 	 * @emits		DocloopCore.link-updated
 	 * 
	 * @return 		undefined
	 * 
	 * @throws		{DocloopError|400}						If id, source or target is missing
	 */
	async handlePutLinkRequest(req, res){

		var id		= req && req.params && req.params.id,
			source	= req && req.body && req.body.source,
			target	= req && req.body && req.body.target



		if(!id) 	throw new DocloopError("DocloopCore.handlePutLinkRequest() missing id", 400)
		if(!source) throw new DocloopError("DocloopCore.handlePutLinkRequest() missing source", 400)
		if(!target) throw new DocloopError("DocloopCore.handlePutLinkRequest() missing target", 400)

		var link = await this.getStoredLink(id) 

		link.source.identifier 	= source.identifier
		link.source.config 		= source.config

		link.target.identifier 	= target.identifier
		link.target.config 		= target.config

		await link._validate(req.session)
		await link.source.update()			
		await link.target.update()

		res.status(200).send(link.export)
		this.emit('link-updated', link.skeleton)
	}







}

module.exports  = DocloopCore
