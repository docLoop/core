'use strict';


const	DocloopCore 	= 	require('../docloop.js').DocloopCore,
		DocloopAdapter	= 	require('../docloop.js').DocloopAdapter,
		DocloopError	= 	require('../docloop.js').DocloopError,
		DocloopEndpoint	=	require('../docloop.js').DocloopEndpoint,
		DocloopLink		=	require('../docloop.js').DocloopLink,
		EventEmitter	=	require('events'),
		chai			= 	require('chai'),
		chaiAsPromised 	= 	require('chai-as-promised'),
		should 			= 	chai.should(),
		sinon			= 	require('sinon'),
		sinonChai 		= 	require('sinon-chai')


chai.use(chaiAsPromised)
chai.use(sinonChai)


var		config			=	{
								sessionSecret:		'abc',
								linkCollection:		'links',
								port:				7777,
								db:					{
														address:	'localhost',
														name:		'test',
														port:		27777
													}
							},
		docloopCore		=	undefined,

		source_data_1	=	{id:"107f1f77bcf86cd799439012", identifier: { adapter: 'test-source-adapter'}}, 
		source_data_2	=	{id:"207f1f77bcf86cd799439012", identifier: { adapter: 'test-source-adapter'}}, 
		target_data_1	=	{id:"307f1f77bcf86cd799439012", identifier: { adapter: 'test-target-adapter'}},
		target_data_2	=	{id:"407f1f77bcf86cd799439012", identifier: { adapter: 'test-target-adapter'}},

		req				=	{
								session: new function Session(){}
							},
		res				=	{}



		res.status	= 	sinon.stub().returns(res),
		res.send	=	sinon.stub().returns(res)


class TestEndpoint extends DocloopEndpoint{
	constructor(adapter, config){
		super(adapter, config)

	}

	updateDecor(){
		return {}
	}
}

class TestSourceAdapter extends DocloopAdapter{

	constructor(core, config){
		config = config || {}

		super(core, {
			...config, 
			id: 			config.id || 'test-source-adapter', 
			type: 			'source',
			endpointClass : TestEndpoint
		})		
	}

	async getsources(){
		return [{adapter: this.id, name: 'my-test-source'}]
	}
}

class TestTargetAdapter extends DocloopAdapter{

	constructor(core, config){
		config = config || {}

		super(core, { 
			...config, 
			id: 			config.id || 'test-target-adapter', 
			type: 			'target',
			endpointClass:	TestEndpoint
		})
	}

	async getTargets(){
		return [{adapter: this.id, name: 'my-test-target'}]
	}
}

class BogusAdapter extends DocloopAdapter{
	constructor(core, config){
		config = config || {}
		super(core, { 
			...config, 
			id: 			'bogus-adapter', 
			type: 			'source',
			endpointClass: 	TestEndpoint
		})
	}

	async _getData(){ throw Error('Test Error') }
}





















describe("DocloopCore", function(){

	beforeEach(function(){
		docloopCore = new DocloopCore(config)
	})




	describe(".constructor()", function(){


		before(function(){
			sinon.stub(process, 'exit')
		})

		beforeEach(function(){
			process.exit.resetHistory()
		})

		after(function(){
			process.exit.restore()
		})








		it("should throw errors if misconfigured.", function(){
			
			//config missing :
			should.Throw( () => new DocloopCore(), 				ReferenceError)
			should.Throw( () => new DocloopCore(null), 			TypeError)
			should.Throw( () => new DocloopCore(''), 			TypeError)
			should.Throw( () => new DocloopCore(0), 			TypeError)
			should.Throw( () => new DocloopCore(false), 		TypeError)

			//config.name wrong type
			should.Throw( () => new DocloopCore({name: 123}), 	TypeError)
			should.Throw( () => new DocloopCore({name: {}}), 	TypeError)
			should.Throw( () => new DocloopCore({name: true}), 	TypeError)

			//config.port wrong type
			should.Throw( () => new DocloopCore({}), 			ReferenceError)
			should.Throw( () => new DocloopCore({port: '123'}), TypeError)
			should.Throw( () => new DocloopCore({port: {}}), 	TypeError)
			should.Throw( () => new DocloopCore({port: true}), 	TypeError)

			//config.sessionSecret
			should.Throw( () => new DocloopCore({port: 123}), 						ReferenceError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 123}), 	TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: {}}), 	TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: true}), 	TypeError)
			

			//config.db
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc'}), 					ReferenceError)

			//config.db.name
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{}}), 				ReferenceError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name: 123}}), 	TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name: {}}}), 		TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name: true}}), 	TypeError)
			
			//config.db.port
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc'}}), 				ReferenceError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc', port: {}}}), 		TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc', port: 'abc'}}), 	TypeError)
			should.Throw( () => new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc', port: true}}), 	TypeError)

		})

		it("should use the correct default values", function(){
			var core = new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc', port: 123}})

			core.config.name.should.equal('Docloop')
			core.config.clientUrl.should.equal('/')

			return core.ready.catch( () => {} )
		})


		it("should exit with exit code 1 if connection to data base cannot be established.", function(done){
			var badCore = new DocloopCore({port: 123, sessionSecret: 'abc', db:{name:'abc', port: 123}})

			badCore.ready.catch( () => {
				process.exit.should.have.been.calledOnce
				process.exit.firstCall.args[0].should.equal(1)
				done() 
			})
					
		})


		it('should have all the properties.', function(){
			

 			docloopCore.should.have.deep.property('config', config)
			docloopCore.should.have.property('app')
			docloopCore.should.have.property('adapters')
			docloopCore.should.have.property('sourceAdapters')
			docloopCore.should.have.property('targetAdapters')
			docloopCore.should.have.property('preventRelayEventNames')
			docloopCore.should.have.property('ready')
		})


		it("should setup the app", function(){

			

			docloopCore.should.be.an.instanceof(EventEmitter)

			

			var actual_routes 	=	[],
				expected_routes =	[
										[ 'GET', 	'/' ],
										[ 'GET', 	'/links' ],
										[ 'GET',	'/links/:id' ],
										[ 'POST', 	'/links' ],
										[ 'PUT',	'/links/:id' ],
										[ 'DELETE',	'/links/:id' ],
										[ 'GET', 	'/adapters' ],
										[ 'GET', 	'/dropSession' ]
									]

			docloopCore.app._router.stack
			.filter( 	item => item.route)
			.forEach( 	item => {
									Object.keys(item.route.methods).forEach( key => {
										if(item.route.methods[key]) actual_routes.push([key.toUpperCase(), item.route.path])
									})
								}
			)

			actual_routes.should.deep.equal(expected_routes)

			return	docloopCore.ready 
					.then( () => {
						docloopCore.should.have.property('db')
						docloopCore.should.have.property('links')
					})
					.should.be.fulfilled

		})

	})





	describe(".use()", function(){

		it("should throw a TypeError if adapterClass does not equal or extend DocloopAdapter", function(){
			docloopCore.use.bind(docloopCore, {})		.should.throw(TypeError)
			docloopCore.use.bind(docloopCore, Array)	.should.throw(TypeError)
			docloopCore.use.bind(docloopCore, null)		.should.throw(TypeError)
			docloopCore.use.bind(docloopCore, 123)		.should.throw(TypeError)
			docloopCore.use.bind(docloopCore, String)	.should.throw(TypeError)
		})
		
		it("should throw a DocloopError | 409 if another adapter with the same id is already in use", function(){
			docloopCore.use(TestSourceAdapter, {id: 'test-1', type : 'source'})
			docloopCore.use.bind(docloopCore, TestSourceAdapter, {id: 'test-1', type: 'source'}).should.throw(DocloopError).that.has.property('status', 409)	
		})

		it("should register a new source adapter", function(){
			docloopCore.use(TestSourceAdapter, {id: 'my-test-source-adapter', type: 'source'})
			docloopCore.adapters.should.have.a.property('my-test-source-adapter')
			docloopCore.adapters['my-test-source-adapter'].should.be.an.instanceOf(TestSourceAdapter)
		})

		it("should register a new target adapter", function(){
			docloopCore.use(TestTargetAdapter, {id: 'my-test-target-adapter', type: 'target'})
			docloopCore.adapters.should.have.a.property('my-test-target-adapter')
			docloopCore.adapters['my-test-target-adapter'].should.be.an.instanceOf(TestTargetAdapter)
		})

	})





	describe(".run()", function(){

		it("should start the app once it's ready", function(){
			
			sinon.stub(docloopCore.app,'listen')

			var resolveReady = undefined

			docloopCore.ready = new Promise( resolve => resolveReady = resolve )

			var runReady = docloopCore.run()
			
			docloopCore.app.listen.should.not.have.been.called

			resolveReady()

			return 	runReady
					.should.eventually.be.fulfilled
					.then( () => {
						docloopCore.app.listen.should.have.been.calledOnce
						docloopCore.app.listen.restore()
					})
		})

	})




	describe(".newLink", function(){

		it("should return a new instance of DocloopLink", function(){
			

			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)

			var link = 	docloopCore.newLink({
							source:	source_data_1,
							target: target_data_1
						})

			link.core.should.equal(docloopCore)
		})

	})





	describe(".get sourceAdapters", function(){

		it("should return all source adapters", function(){
			

			docloopCore.sourceAdapters.should.have.lengthOf(0)

			docloopCore.use(TestTargetAdapter)

			docloopCore.sourceAdapters.should.have.lengthOf(0)

			docloopCore.use(TestSourceAdapter)

			docloopCore.sourceAdapters.should.have.lengthOf(1)

		})

	})





	describe(".get targetAdapters", function(){

		it("should return all target adapters", function(){
			

			docloopCore.targetAdapters.should.have.lengthOf(0)

			docloopCore.use(TestSourceAdapter)

			docloopCore.targetAdapters.should.have.lengthOf(0)

			docloopCore.use(TestTargetAdapter)

			docloopCore.targetAdapters.should.have.lengthOf(1)

		})

	})






	describe(".getStoredLink", function(){

		beforeEach(function(){
			
			return docloopCore.ready
		})

		it("should throw a ReferenceError if no id is provided", function(){
			return 	docloopCore.getStoredLink()
					.should.eventually.be.rejectedWith(ReferenceError)
		})

		it("should throw a TypeError if id cannot be converted to ObjectId", function(){
			return	docloopCore.getStoredLink('abc')
					.should.eventually.be.rejectedWith(TypeError)
		})

		it("should throw a DocloopError|404 if no matching link can be found", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve(null))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError).with.property('status', 404)
			
		})

		it("should throw a DocloopError if retrieved link lacks a source", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError if retrieved link lacks a target", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})


		it("should throw a DocloopError if retrieved link lacks a source adapter", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{}, target:{}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})


		it("should throw a DocloopError if retrieved link lacks a target adapter", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'abc'}, target:{}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError if retrieved link lacks a source id", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'abc'}, target:{adapter:'abc'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError if retrieved link lacks a target id", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'abc', id:'123'}, target:{adapter:'abc'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError if retrieved link lacks a matching source adapter", function(){
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'abc', id:'123'}, target:{adapter:'abc', id: '123'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError if retrieved link lacks a matching target adapter", function(){
			docloopCore.use(TestSourceAdapter)

			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'test-source-adapter', id:'123'}, target:{adapter:'abc', id: '123'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})

		it("should throw a DocloopError|404 if retrieved link lacks a matching stored source endpoint", function(){
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)

			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'test-source-adapter', id:'507f1f77bcf86cd799439011'}, target:{adapter:'test-target-adapter', id: '507f1f77bcf86cd799439011'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
			
		})


		it("should throw a DocloopError|404 if retrieved link lacks a matching stored target endpoint", function(){
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)

			sinon.stub(TestSourceAdapter.prototype,"getStoredEndpoint").returns({})
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'test-source-adapter', id:'507f1f77bcf86cd799439011'}, target:{adapter:'abc', id: '507f1f77bcf86cd799439011'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.should.eventually.be.rejectedWith(DocloopError)
					.then( () => TestSourceAdapter.prototype.getStoredEndpoint.restore() )
			
		})


		it("should return a new instance of DocloopLink corresponding to the provided id", function(){
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)


			sinon.stub(TestSourceAdapter.prototype,"getStoredEndpoint").returns(source_data_1)
			sinon.stub(TestTargetAdapter.prototype,"getStoredEndpoint").returns(target_data_1)
			sinon.stub(docloopCore.links, "findOne").returns(Promise.resolve({source:{adapter:'test-source-adapter', id:'123'}, target:{adapter:'test-target-adapter', id: '123'}}))

			return 	docloopCore.getStoredLink('507f1f77bcf86cd799439011')
					.then( link => {
						link.should.be.instanceOf(DocloopLink)
						link.source.id.toString().should.equal(source_data_1.id)
						link.target.id.toString().should.equal(target_data_1.id)
						link.id.toString().should.equal('507f1f77bcf86cd799439011')
					})
					.then( () => docloopCore.links.findOne.restore() )
					.then( () => TestTargetAdapter.prototype.getStoredEndpoint.restore() )
					.then( () => TestSourceAdapter.prototype.getStoredEndpoint.restore() )
					.should.be.fulfilled
			
		})


	})





	describe(".syncRelayListeners", function(){

		beforeEach(function(){
			
		})


		it("should throw errors if called with bad arguments", function(){
			docloopCore.syncRelayListeners.bind(docloopCore).should.throw(ReferenceError)
			docloopCore.syncRelayListeners.bind(docloopCore, {}).should.throw(TypeError)
			docloopCore.syncRelayListeners.bind(docloopCore, null).should.throw(TypeError)
			docloopCore.syncRelayListeners.bind(docloopCore, 123).should.throw(TypeError)
			docloopCore.syncRelayListeners.bind(docloopCore, Array).should.throw(TypeError)
			docloopCore.syncRelayListeners.bind(docloopCore, docloopCore).should.throw(TypeError)
			docloopCore.syncRelayListeners.bind(docloopCore, true).should.throw(TypeError)
		})
		

		it("should add an event listener to the adapter for each evenntlistener on the core except those in .preventRelayEventNames", function(){

			sinon.stub(docloopCore, "relayEvent")

			var adapter = new TestSourceAdapter(docloopCore),
				count	= adapter.eventNames().length

			docloopCore.on(docloopCore.preventRelayEventNames[0], () => {})
			docloopCore.on('test-1', () => {})
			docloopCore.on('test-2', () => {})
			docloopCore.on('test-3', () => {})

			docloopCore.syncRelayListeners(adapter)

			adapter.eventNames().length.should.equal(count+3)

			docloopCore.on('test-4', () => {})
			docloopCore.on('test-5', () => {})

			adapter.eventNames().length.should.equal(count+5)

			docloopCore.on(docloopCore.preventRelayEventNames[1], () => {})

			adapter.eventNames().length.should.equal(count+5)


			adapter.emit('test-2')
			adapter.emit('test-3')
			adapter.emit('test-4')

			docloopCore.relayEvent.should.have.been.calledThrice


		})

	})





	describe(".relayEvent", function(){

		beforeEach(function(){
			
			return docloopCore.ready
		})

		it("throw errors if caled with bad arguments", function(){
			return Promise.all([
				docloopCore.relayEvent().should.be.rejectedWith(ReferenceError),
				docloopCore.relayEvent(123).should.be.rejectedWith(TypeError),
				docloopCore.relayEvent(Array).should.be.rejectedWith(TypeError),
				docloopCore.relayEvent({}).should.be.rejectedWith(TypeError),
				docloopCore.relayEvent(true).should.be.rejectedWith(TypeError),
				docloopCore.relayEvent(null).should.be.rejectedWith(TypeError),
				docloopCore.relayEvent('test-xx', {source:{}}).should.be.rejectedWith(ReferenceError)
			])

		})

		it("should do nothing and just resolve with null, if the event data has no source property", function(){
			return 	docloopCore.relayEvent('test-abc', {something:{}})
					.should.be.fulfilled
					.then( result => should.not.exist(result) )
		})

		it("should reemit an adapter event with a source property on the core replacing the source with a linked target", function(done){
			sinon.stub(docloopCore.links, 'find').returns({toArray: () => [
				{
					source: source_data_1,
					target: target_data_1
				},
				{
					source: source_data_1,
					target: target_data_2
				},

			]})

			var count 	= 0,
				targets = []

			docloopCore.on('test', event => {
				count ++
				targets.push(event.target)

				if(count == 2){
					targets.should.deep.include(target_data_1)
					targets.should.deep.include(target_data_2)
					done()
				}
			})

			docloopCore.relayEvent('test', {source: { id:source_data_1.id, adapter: source_data_1.identifier.adapter}})
		})


	})






	describe(".handleGetRootRequest", function(){

		it("should send 200 with app data", function(){
			res.status.resetHistory()
			res.send.resetHistory()

			

			return 	docloopCore.handleGetRootRequest(null, res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.lastCall.args[0].should.deep.equal({
							name:		config.name,
							version:	process.env.npm_package_version
						})
					})
					.should.be.fulfilled
		})

	})





	describe(".handleDropSessionRequest", function(){

		beforeEach(function(){
			

			docloopCore.use(TestTargetAdapter)
			docloopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

		})

		it("should destroy current session and resolve request with status 200 on success", function(){

			req.session.destroy = callback => callback(null)
			
			return 	docloopCore.handleDropSessionRequest(req,res)
					.then( ()=>{
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
					})
					.should.be.fulfilled



		})

		it("should try to destroy current session and be rejected with an DocloopError on failure", function(){

			req.session.destroy = callback => callback(true)

			return 	docloopCore.handleDropSessionRequest(req,res)
					.should.eventually.be.rejectedWith(DocloopError)


		})
	})





	describe(".handleGetAdaptersRequest", function(){

		beforeEach(function(){
			

			docloopCore.use(TestTargetAdapter)
			docloopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

		})

		it("should resolve the request with status 200 and a list of all adapters on success", function(){
			
			return 	docloopCore.handleGetAdaptersRequest(req,res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						res.send.firstCall.args[0].should.have.lengthOf(2)
					})
					.should.be.fulfilled
		})

		it("should be rejected on failure", function(){
			
			docloopCore.use(BogusAdapter)

			return 	docloopCore.handleGetAdaptersRequest(req,res)
					.should.eventually.be.rejected
		})

	})





	describe(".handleGetLinkRequest", function(){


		it("should throw a DocloopError|400 if param.id is not present on req", function(){
			return 	docloopCore.handleGetLinkRequest()
					.should.eventually.be.rejectedWith(DocloopError).with.property('status', 400)
		})

		it("should resolve with the result of .getStoredLink", function(){
			

			sinon.stub(docloopCore, "getStoredLink").returns({export: '123'})

			return 	docloopCore.handleGetLinkRequest({params:{id:'abc'}}, res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledWith('123')
					})	
					.should.be.fulfilled
		})

	})





	describe(".handleGetLinksRequest", function(){

		beforeEach(function(){
			

			docloopCore.use(TestTargetAdapter)
			docloopCore.use(TestSourceAdapter)

			res.status.resetHistory()
			res.send.resetHistory()

			var sourceAdapter = docloopCore.adapters['test-source-adapter'],
				targetAdapter = docloopCore.adapters['test-target-adapter']

			var source_1 = sourceAdapter.newEndpoint(source_data_1),
				source_2 = sourceAdapter.newEndpoint(source_data_2),
				target_1 = targetAdapter.newEndpoint(target_data_1), 
				target_2 = targetAdapter.newEndpoint(target_data_2) 

			sinon.stub(TestSourceAdapter.prototype, '_getStoredEndpoints').returns(Promise.resolve([
				source_1,
				source_2				
			]))


			sinon.stub(TestTargetAdapter.prototype, '_getStoredEndpoints').returns(Promise.resolve([
				target_1,
				target_2
			]))

			return docloopCore.ready
					.then( () => {
						sinon.stub(docloopCore.links,'find').returns({toArray: () => Promise.resolve([
							{	
								_id: 1, 
								source: 	source_1.skeleton,
								target:		target_1.skeleton
							},
							{	
								_id: 2, 
								source:		source_1.skeleton,
								target:		target_2.skeleton
							},
							{	
								_id: 3, 
								source:		source_2.skeleton,
								target:		target_1.skeleton
							}				
						])})
					})

		})

		afterEach(function(){
			docloopCore.links.find.restore()

			TestSourceAdapter.prototype._getStoredEndpoints.restore()
			TestTargetAdapter.prototype._getStoredEndpoints.restore()
		})


		it("should send status 200 and [] if there are no source adapters", function(){
			var stub = sinon.stub(docloopCore, 'sourceAdapters').get( () => [] )
			
			docloopCore.handleGetLinksRequest(req, res)
			
			stub.restore()
		})

		it("should send status 200 and [] if there are no target adapters", function(){
			var stub = sinon.stub(docloopCore, 'targetAdapters').get( () => [] )
			
			docloopCore.handleGetLinksRequest(req, res)
			
			stub.restore()
		})



		it("should send status 200 and a list of links on success", function(){


			return 	docloopCore.handleGetLinksRequest(req, res)
					.catch(console.log)
					.should.eventually.be.fulfilled
					.then( () => {
						docloopCore.links.find.should.have.been.calledOnce
						should.exist(docloopCore.links.find.firstCall.args[0].$and)
						docloopCore.links.find.firstCall.args[0].$and[0].$or.should.have.lengthOf(2)
						docloopCore.links.find.firstCall.args[0].$and[1].$or.should.have.lengthOf(2)

						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						res.send.firstCall.args[0].should.have.lengthOf(3)
					})

		})

	})





	describe(".handleDeleteLinkRequest", function(){

		it("should be rejected with a DocloopError if id is missing", function(){
			return 	docloopCore.handleDeleteLinkRequest({})
					.should.eventually.be.rejectedWith(DocloopError).with.property('status', 400)
		})



		it("should be rejected if link wont validate", function(){
			sinon.stub(docloopCore,'getStoredLink').returns({_validate: () => { throw new Error() }})
			sinon.stub(docloopCore,'emit')

			return 	docloopCore.handleDeleteLinkRequest({params:{id:'xyz'}, session: 'my_session'}, res)
					.should.be.rejected
					.then( () => { docloopCore.emit.should.not.have.been.called })
		})



		it("should be rejected if link wont valiate", function(){
			sinon.stub(docloopCore,'getStoredLink').returns({
				_validate: 	() => { },
				remove:		() => { throw new Error() }	
			})
			sinon.stub(docloopCore,'emit')

			return 	docloopCore.handleDeleteLinkRequest({params:{id:'xyz'}, session: 'my_session'}, res)
					.should.be.rejected
					.then( () => docloopCore.emit.should.not.have.been.called )
		})



		it("should delete link with the provided id and emit event", function(){
			var skeleton	=	{},
				pseudo_link = 	{
									_validate: 	sinon.stub(),
									remove:		sinon.stub(),
									skeleton
								}

			sinon.stub(docloopCore,'getStoredLink').returns(pseudo_link)
			sinon.stub(docloopCore,'emit')

			return	docloopCore.handleDeleteLinkRequest({params:{id:'xyz'}, session: 'my_session'}, res)
					.then( () => {

						docloopCore.getStoredLink.should.have.been.calledOnce
						docloopCore.getStoredLink.firstCall.args.should.include('xyz')
						
						docloopCore.emit.should.have.been.calledOnce
						docloopCore.emit.firstCall.args.should.include('link-removed', skeleton)

						pseudo_link._validate.should.have.been.calledOnce
						pseudo_link._validate.firstCall.args.should.include('my_session')
						
						pseudo_link.remove.should.have.been.calledOnce
					})
					should.be.fulfilled
		})

	})
	




	describe(".handlePostLinkRequest", function(){


		before(function(){
			sinon.stub(DocloopLink.prototype,'store').returns(Promise.resolve())
		})

		beforeEach(function(){
			res.status.resetHistory()
			res.send.resetHistory()
			DocloopLink.prototype.store.resetHistory()
			sinon.stub(docloopCore,'emit')
		})

		afterEach(function(){
		})

		after(function(){
			DocloopLink.prototype.store.restore()
		})

		it("should throw a DocloopError|400 if either source or target parameters are lacking data", function(){

			return Promise.all([
				docloopCore.handlePostLinkRequest({}, {})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePostLinkRequest({source:{}}, {})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePostLinkRequest({source:{}}, {target:{}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePostLinkRequest({source:{identifier:{}}}, {target:{}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePostLinkRequest({source:{identifier:{}}}, {target:{identifier:{}}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),
			])
			.then( () => {
				DocloopLink.prototype.store.should.not.have.been.called
				res.status.should.not.have.been.called
				res.send.should.not.have.been.called
				docloopCore.emit.should.not.have.been.called
			})
		})




		it("should not try to store the link if no new link can be instantiated", function(){
			sinon.stub(docloopCore,'newLink').returns(Promise.reject(new Error()))

			return 	docloopCore.handlePostLinkRequest(
						{
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.rejected
					.then( () => {
						res.status.should.not.have.been.called
						res.send.should.not.have.been.called
						docloopCore.emit.should.not.have.been.called
						DocloopLink.prototype.store.should.not.have.been.called
						docloopCore.newLink.restore()
					})
		})


		it("should not try to store the link if it doesnt validate", function(){
			sinon.stub(DocloopLink.prototype,'_validate').returns(Promise.reject(new Error()))
			
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)
			.emit.resetHistory()

			return 	docloopCore.handlePostLinkRequest(
						{
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.rejected
					.then( () => {
						DocloopLink.prototype._validate.restore()
						res.status.should.not.have.been.called
						res.send.should.not.have.been.called
						docloopCore.emit.should.not.have.been.called
						DocloopLink.prototype.store.should.not.have.been.called
					})
		})

		it("should not try to store the link if a duplicate exists", function(){
			sinon.stub(DocloopLink.prototype,'_validate').returns(Promise.resolve())
			sinon.stub(DocloopLink.prototype,'preventDuplicate').returns(Promise.reject(new Error()))
			

			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)
			.emit.resetHistory()

			return 	docloopCore.handlePostLinkRequest(
						{
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.rejected
					.then( (e) => {
						res.status.should.not.have.been.called
						res.send.should.not.have.been.called
						docloopCore.emit.should.not.have.been.called
						DocloopLink.prototype.store.should.not.have.been.called
						DocloopLink.prototype._validate.restore()
						DocloopLink.prototype.preventDuplicate.restore()
					})
		})

		it("should emit link-established and send link data as result if link was successfully stored.", function(){
			sinon.stub(DocloopLink.prototype,'_validate').returns(Promise.resolve())
			sinon.stub(DocloopLink.prototype,'preventDuplicate').returns(Promise.resolve())
			

			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)
			.emit.resetHistory()

			return 	docloopCore.handlePostLinkRequest(
						{
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.fulfilled
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						docloopCore.emit.should.have.been.calledWith('link-established')
						DocloopLink.prototype._validate.should.have.been.calledOnce
						DocloopLink.prototype._validate.restore()
						DocloopLink.prototype.preventDuplicate.restore()
					})
		})


	})


	

	describe(".handlePutLinkRequest", function(){

		beforeEach(function(){
			res.status.resetHistory()
			res.send.resetHistory()
			sinon.stub(docloopCore,'emit')
		})

		it("should throw a DocloopError|400 if link id is missing or either source or target parameters are lacking data", function(){

			var link = 	{
							_validate: 	sinon.stub(),
							source:		{ update: sinon.stub() },
							target:		{ update: sinon.stub() },
						}

			sinon.stub(docloopCore,'getStoredLink').returns(link)

			return Promise.all([
				docloopCore.handlePutLinkRequest({}, {})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePutLinkRequest({params:{id:'abc'}}, {})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePutLinkRequest({params:{id:'abc'}, source:{}}, {})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePutLinkRequest({params:{id:'abc'}, source:{}}, {target:{}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePutLinkRequest({params:{id:'abc'}, source:{identifier:{}}}, {target:{}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),

				docloopCore.handlePutLinkRequest({params:{id:'abc'}, source:{identifier:{}}}, {target:{identifier:{}}})
				.should.eventually.be.rejected
				.and.be.an.instanceOf(DocloopError)
				.and.have.property('status', 400),
			])
			.then( () => {
				res.status.should.not.have.been.called
				res.send.should.not.have.been.called
				docloopCore.emit.should.not.have.been.called
				link._validate.should.not.have.been.called
				link.source.update.should.not.have.been.called
				link.target.update.should.not.have.been.called
			})
		})




		it("should not emit update event if link was not found", function(){
			sinon.stub(docloopCore,'getStoredLink').returns(Promise.reject(new Error()))

			return 	docloopCore.handlePutLinkRequest(
						{
							params: {id: 'abc'},
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.rejected
					.then( () => {
						res.status.should.not.have.been.called
						res.send.should.not.have.been.called
						docloopCore.emit.should.not.have.been.called
					})
		})


		it("should not try to update the link if it doesn't validate", function(){
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)
			.emit.resetHistory()

			var link = 	{
							_validate: 	sinon.stub().returns(Promise.reject(new Error())),
							source:		{ update: sinon.stub() },
							target:		{ update: sinon.stub() },
						}

			sinon.stub(docloopCore,'getStoredLink').returns(link)

			return 	docloopCore.handlePutLinkRequest(
						{
							params: {id: 'abc'},
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.should.be.rejected
					.then( () => {
						res.status.should.not.have.been.called
						res.send.should.not.have.been.called
						docloopCore.emit.should.not.have.been.called
						link.source.update.should.not.have.been.called
						link.target.update.should.not.have.been.called
					})
		})


		it("should emit link-updated and send link data as result if link was successfully updated.", function(){
			docloopCore
			.use(TestSourceAdapter)
			.use(TestTargetAdapter)
			.emit.resetHistory()



			var link = 	{
							_validate: 	sinon.stub().returns(Promise.resolve()),
							source:		{ update: sinon.stub().returns(Promise.resolve()) },
							target:		{ update: sinon.stub().returns(Promise.resolve()) },
							export:		'test-export',
							skeleton:	 'test-skeleton'
						}

			sinon.stub(docloopCore,'getStoredLink').returns(link)


			return 	docloopCore.handlePutLinkRequest(
						{
							params: {id: 'abc'},
							body:{
								source:	source_data_1,
								target: target_data_1
							}
						},
						res
					)
					.catch(console.log)
					.should.be.fulfilled
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledWith('test-export')
						docloopCore.emit.should.have.been.calledWith('link-updated', 'test-skeleton')
						link._validate.should.have.been.calledOnce
						link.source.update.should.have.been.calledOnce
						link.target.update.should.have.been.calledOnce
					})
		})
		
	})

})

