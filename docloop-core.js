'use strict'

/**
 * @event 		link-established
 * @type		{LinkSkeleton}
 */

/**
 * @event 		link-removed
 * @type		{LinkSkeleton}
 */

/**
 * @event 		link-updated
 * @type		{LinkSkeleton}
 */


/**
 * @typedef {Object} Collections
 * TODO: get own collections form daapter
 */


/**
 * Either {@link DocLoopAdapter} or any Class extending it. 
 * @typedef {Class} AdapterClass
 */

/**
 * An instance of either {@link DocLoopAdapter} or any Class extending it. 
 * @typedef {Object} Adapter
 */

const 	EventEmitter 	= require('events'),
		DocloopLink		= require('./docloop-link.js'),
		DocloopError	= require('./docloop-error-handling.js').DocloopError,
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
 * The Docloop  core system. An instance of this class is be used to setup the application and will also be passed to all adapters as core..
 * @memberof	module:Docloop  
 * @param  		{Object} 				config  
 * @param 		{string} 				config.name				TODO: This doesnt seem to be used at all? oO
 * @param 		{string} 				config.port				The port the app  will respond to.
 * @param 		{string} 				config.home				Project website: TODO: where is this used?
 * @param 		{string} 				config.frontEndUrl:		The Url of the frontend. This is needed if you want to redirect the user back to the client after some extenal authentication. TODO: rename to 'clientUrl'
 * @param 		{string} 				config.sessionSecret:	Your session secret, used in express session config.
 * @param 		{Object} 				config.db				Databse configuration	
 * @param 		{string} 				config.db.path			Local path to db. TODO: Is this ever used? 		
 * @param 		{string} 				config.db.name			mongo-db name
 * @param 		{string} 				config.db.port			mongo-db port
 * @property 	{ExpressApp} 			app 					The express app
 * @property 	{Object} 				adapters 				Hash map of all used adapters. Adapters' ids are used as keys.
 * @property 	{DocloopAdapter[]} 		sourceAdapters 			Array of all used source adapters
 * @property 	{DocloopAdapter[]} 		targetAdapters 			Array of all used target adapters
 * @emits		link-established
 * @emits		link-removed
 * @emits		link-updated
 */

class DocloopCore extends EventEmitter {

	constructor(config){
		super()

		this.config		= 	config
		this.adapters 	= 	{}

		// Databse
		this.dbPromise 	= 	MongoClient.connect('mongodb://localhost:'+this.config.db.port+'/'+this.config.db.name)
							.then( db => {
								this.db 	= db
								this.links 	= db.collection('links')
								return db
							})

		this.app		= 	express()

		//Sessions
		this.app.use(session({
			name:				'docloop.sid',
			secret:				config.sessionSecret,
			store:				new MongoStore( { dbPromise: this.dbPromise } ),
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

		this.app.get(	'/links/:id', 		catchAsyncErrors(this.handleGetLinkRequest.bind(this)))
		this.app.post(	'/links', 			catchAsyncErrors(this.handlePostLinkRequest.bind(this)))
		this.app.delete('/links/:id', 		catchAsyncErrors(this.handleDeleteLinkRequest.bind(this)))
		this.app.put(	'/links/:id', 		catchAsyncErrors(this.handlePutLinkRequest.bind(this)))

		this.app.get(	'/links', 			catchAsyncErrors(this.handleGetLinksRequest.bind(this)))
		this.app.get(	'/adapters', 		catchAsyncErrors(this.handleGetAdaptersRequest.bind(this)))
		this.app.get(	'/dropSession', 	catchAsyncErrors(this.handleDropSessionRequest.bind(this)))

		this.app.use(errorHandler)


		//Events

		this.preventRelayEventNames = [

			'newListener', 
			'removeListener', 

			'link-established',
			'link-removed',
			'link-updated'
		],


		//Ready:

		this.ready	 = 	Promise.join(
							this.dbPromise
						)
						.catch(err => { throw err }) //doesnt do anything, does it? Add to log

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
	 * @param  {DocloopAdapter} 	AdapterClass 	Any Class extending {@link DocloopAdapter}
	 * @param  {Object} config		The configuration object for th custim adapter class.
	 * @return {this} 				for chaining
	 */
	use(AdapterClass, config){

		var adapter = new AdapterClass(this, config)

		if(this.adapters[adapter.id]) throw new Error("DocloopCore.use() cannot register two adapters with the same id: " + adapter.id)

		this.adapters[adapter.id] = adapter

		this.syncRelayListeners(adapter)

		//TODO: keep track of bound realy functions. listen to 'newlistener', dont sync all adpazters all the time.

		return this
	}

	/**
	 * Start the App and listen to the configured port.
	 * @return {undefined}
	 */
	run(){		
		this.ready
		.then( () => {
			console.log('docLoop running, db on port ' + this.config.db.port + ' ...')
			this.app.listen(this.config.port)
		})
	}

	/**
	 *Create new instance of {@link DocLoopLink} with this as core using the provided data.
	 * 
	 * @param 	{object} 		data 	Configuration data for the new Link instance.
	 * @return 	{DocloopLink} 			
	 */
	newLink(data){
		return new Link(this, data)
	}

	/**
	 * Get all source adapters.
	 * 
	 * @type {DocloopAdapter[]}
	 */
	get sourceAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'source')
	}

	/**
	 * Get all target adapters.
	 * 
	 * @type {DocloopAdapter[]}
	 */

	get targetAdapters(){
		return Object.values(this.adapters).filter( adapter => adapter.type == 'target')
	}





	/**
	 *Get a strored link.
	 * 
	 * @param  	{string|bson}		mongo-db id 
	 * @return 	{DocloopLink}
	 * @throws	{DocloopError|404}					If no link was found mathcing the id.
	 * @throws	{DocloopError}						If the stored link's source skeleton is missing or incomplete.
	 * @throws	{DocloopError}						If the stored link's target skeleton is missing or incomplete.
	 * @throws	{DocloopError}						If there is no registered adapter to match the source adapter.
	 * @throws	{DocloopError}						If there is no registered adapter to match the target adapter.
	 * @throws	{DocloopError}						If the source or target cannot be read from the respective collections.
	 */
	async getStoredLink(id){

		if(!id) throw ReferenceError("docLoopCore.getStoredLink() missing id")
		if(id._bsontype != 'ObjectId') id = ObjectId(id)


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

		if(!source_adapter)					throw new DocloopError("docLoopCore.getStoredLink() unable find matching source adapter")	
		if(!target_adapter)					throw new DocloopError("docLoopCore.getStoredLink() unable find matching target adapter")	

		var	[source, target] 	=  	await	Promise.all([
												source_adapter.getStoredEndpoint(link_skeleton.source.id),
												target_adapter.getStoredEndpoint(link_skeleton.target.id)
											])

		if(!source)							throw new DocloopError("docLoopCore.getStoredLink() unable to find matching source")
		if(!target)							throw new DocloopError("docLoopCore.getStoredLink() unable to find matching target")

		return this.newLink({id, source, target})
	}




	
	/**
	 * Setup event listeners such that every time an event fires on an adapter it gets relayed to the core via {@link DocloopCore#relayEvent}.
	 * 
	 * @param  {Adapter}
	 * @return {undefined}
	 *
	 * @listens newListener
	 */
	syncRelayListeners(adapter) {

		var ignore_events_array		= this.preventRelayEventNames,
			core_event_names_array  = this.eventNames().filter( event_name => ignore_events_array.indexOf(event_name) == -1)

		core_event_names_array.forEach( event_name => {
			adapter.on(event_name, this.relayEvent.bind(this, event_name) ) 
		})

		this.on('newListener', 	event_name => adapter.on(event_name, this.relayEvent.bind(this, event_name) ))
	}




	/**
	 * Relay an event if it has a source property. 
	 * For every Link with this source reemits the events on core replacing the source property with the link's target.
	 * This way one adapter can emit an event and everyother (linked) adapter can listen to it on the core.
	 * 
	 * @async
	 * @param  {String}				event_name		The event name
	 * @param  {data}				data			Event data
	 * @return {undefined}
	 *
	 * @throws	{ReferenceError}					If either source.id or source.adapter is missing.
	 */
	async relayEvent(event_name, data) {

		//If the event wasn't meant to be relayed:
		if(!data || !data.source)	return null

		var source 	= data.source

		delete data.source

		//If it was meant to be relayed but, crucial data is missing: 
		if(!source.id) 			throw new ReferenceError('docLoopCore.relayEvent()) missing source id')
		if(!source.adapter) 	throw new ReferenceError('docLoopCore.relayEvent()) missing source adapter')


		var links	= await this.links.find({source}).toArray()


		links
		.map( 		link 	=> link.target)
		.forEach( 	target 	=> this.emit(event_name, { ...data, target, relayed: true} ) )
	}



	/**
	 * Express request handler. Destroys the current session.
	 * 
	 * @param  {Object}		req		Express request object
	 * @param  {Object}		res		Express result object
	 * @return {undefined}
	 */
	async handleDropSessionRequest(req, res){
		req.session.destroy( err => {
			if(err) throw err
			res.status(200).send('Session dropped.')
		})
	}


	/**
	 * Express request handler. Get data for all adapters.
	 * 
	 * @param  {Object}		req		Express request object
	 * @param  {Object}		res		Express result object
	 * @return {undefined}
	 */
	async handleGetAdaptersRequest(req, res){
		var	adapters_array 	= 		Object.keys(this.adapters).map( id => this.adapters[id] ),
			adapters_data	= await	Promise.all( adapters_array.map( adapter => adapter._getData(req.session) ) )

		res.status(200).send(adapters_data)
	}

	/**
	 * Express request handler. Get data of a single link.
	 * 
	 * @param  {Object}		req		Express request object
	 * @param  {Object}		res		Express result object
	 * @return {undefined}
	 */
	async handleGetLinkRequest(req, res){
		var link = await this.getStoredLink(req.params.id) 

		res.status(200).send(link.export)
	}


	/**
	 * Express request handler. Gets data of all link accessible by the current session.
	 * 
	 * @param  {Object}		req		Express request object
	 * @param  {Object}		res		Express result object
	 * @return {undefined}
	 */
	async handleGetLinksRequest(req, res){

		var sources			=	[].concat.apply([], await Promise.map(this.sourceAdapters, adapter => adapter._getStoredEndpoints(req.session) ) ),
			targets			=	[].concat.apply([], await Promise.map(this.targetAdapters, adapter => adapter._getStoredEndpoints(req.session) ) )



		if(sources.length == 0) return res.status(200).send([])
		if(targets.length == 0) return res.status(200).send([])


		var	source_queries 	= 	sources.map( source => ({'source.id' : source.id, 'source.adapter': source.identifier.adapter}) ),
			target_queries 	= 	targets.map( target => ({'target.id' : target.id, 'target.adapter': target.identifier.adapter}) )

		var	raw_links		=	await	this.links.find({
											"$and": [
												{ "$or": source_queries },
												{ "$or": target_queries }
											]
										}).toArray()

		var links			= 	raw_links
								.map( raw_link 	=> this.newLink({
									id:			raw_link._id,
									source : 	sources.filter( source => source.adapter.id == raw_link.source.adapter && source.id.equals(raw_link.source.id) )[0],
									target : 	targets.filter( target => target.adapter.id == raw_link.target.adapter && target.id.equals(raw_link.target.id) )[0],
								}))


		await	Promise.map( 
					links,
					link	=> Promise.join(link.source.updateDecor(req.session), link.target.updateDecor(req.session)) 
				)						

				
		res.status(200).send(links.map( link => link.export ))

	}
	

	//TODO: Tests


	/**
	 * Express request handler. Removes a link.
	 * 
	 * @param  {Object}		req		Express request object
	 * @param  {Object}		res		Express result object
	 * @return {undefined}
	 */
	async handleDeleteLinkRequest(req, res){

		var link = await this.getStoredLink(req.params.id) 

		await link._validate(req.session)
		await link.remove()
		
		this.emit('link-removed', link.skeleton)

		res.status(200).send("link removed")
	}



	/**
	 * Express request handler. Creates a new link out of posted source and target, validates and stores the link.
	 *
	 * @async
	 * @param  		{Object} 			req			Express request object
	 * @param  		{Object} 			req.source	TODO: Endpoint data
	 * @param  		{Object} 			req.target	TODO: Endpoint data
	 * @param  		{Object} 			res			Express result object
	 * @return 		{undefined}
	 * 
 	 * @emits		link-removed
	 * @throws		{DocloopError|400}				If source or target is missing
	 * @throws		{DocloopError|400}				if either sourc or target wont validate
	 * @throws		{DocloopError|409}				If there's already another link between the same source and target
	 * @throws		{DocloopError|500}				If link cannot be stored
	 */
	async handlePostLinkRequest(req, res){

		var source	= req.body.source,
			target	= req.body.target


		//TODO: throw errors:

		if(!source) throw new DocloopError("DocloopCore.handlePostLinkRequest() missing source", 400)
		if(!target) throw new DocloopError("DocloopCore.handlePostLinkRequest() missing target", 400)


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
	 * Express request handler. Updates an existing link. (TODO: restrict to Config?)
	 *
	 * @async
	 * @param  		{Object} 			req					Express request object
	 * @param  		{Object} 			req.params.id		TODO: Endpoint data
	 * @param  		{Object} 			req.body.source		TODO: Endpoint data
	 * @param  		{Object} 			req.body.target		TODO: Endpoint data
	 * @param  		{Object} 			res					Express result object
	 * @return 		{undefined}
	 * 
 	 * @emits		link-updated
	 * @throws		{DocloopError|400}						If id, source or target is missing
	 */
	async handlePutLinkRequest(req, res){

		var id		= req.params.id,
			source	= req.body.source,
			target	= req.body.target



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

		res.status(200).send("link updated")
	}







}

module.exports  = DocloopCore
