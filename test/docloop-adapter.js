'use strict';

const	DocloopCore 	= 	require('../docloop.js').DocloopCore,
		DocloopAdapter	= 	require('../docloop.js').DocloopAdapter,
		DocloopError	= 	require('../docloop.js').DocloopError,
		DocloopEndpoint	=	require('../docloop.js').DocloopEndpoint,
		// DocloopLink		=	require('../docloop.js').DocloopLink,
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
		docloopCore		=	new DocloopCore(config),
		adapter_config	=	{
								id:				'test-adapter', 
								type:			'source', 
								name:			'TestAdapter',
								endpointClass:	DocloopEndpoint,
								extraEndpoints:	false,
							},
		endpoint_data	=	{id:"507f1f77bcf86cd799439012", identifier: { adapter: 'test-adapter'}}, 

		docloopAdapter 	=	undefined,

		req				=	{
								session: new function Session(){}
							},
		res				=	{}



res.status	= 	sinon.stub().returns(res),
res.send	=	sinon.stub().returns(res)


describe("DocloopAdapter", function(){

	beforeEach(function(){
		docloopAdapter = new DocloopAdapter(docloopCore, adapter_config)

		res.status.resetHistory()
		res.send.resetHistory()
	})

	describe(".constructor()", function(){


		it("should throw errors if misconfigured", function(){

			should.Throw( () => new DocloopAdapter() , 		ReferenceError)
			should.Throw( () => new DocloopAdapter({}) , 	TypeError)
			should.Throw( () => new DocloopAdapter(123) , 	TypeError)
			should.Throw( () => new DocloopAdapter('abc') ,	TypeError)
			should.Throw( () => new DocloopAdapter(null) , 	TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore), 			ReferenceError)
			should.Throw( () => new DocloopAdapter(docloopCore,{}), 		ReferenceError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:123}) , 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:{}}) , 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:null}) , TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc'}),	 			ReferenceError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:{}}), 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:132}), 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:null}), 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:true}), 	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'abc'}),	RangeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source'}),						ReferenceError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source', endpointClass:{}}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source', endpointClass:123}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source', endpointClass:'abc'}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source', endpointClass:null}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{id:'abc', type:'source', endpointClass:true}),	TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraId: 123}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraId: {}}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraId: true}),	TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, name: 123}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, name: {}}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, name: true}),	TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraEndpoints: 123}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraEndpoints: {}}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraEndpoints: 'abc'}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, extraEndpoints: null}),	TypeError)

			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, endpointDefaultConfig: 123}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, endpointDefaultConfig: 'abc'}),	TypeError)
			should.Throw( () => new DocloopAdapter(docloopCore,{...adapter_config, endpointDefaultConfig:  true}),	TypeError)

		})



		it("should have all the properties when ready", function(){

			docloopAdapter.should.be.an.instanceOf(EventEmitter)
			docloopAdapter.should.have.property('ready').that.is.an.instanceOf(Promise)

			var actual_routes 	=	[],
				expected_routes =	[
										[ 'GET', 	'/' ],
										[ 'GET', 	'/endpoints' ],
										[ 'GET', 	'/guessEndpoint/:str' ]
									]



			return 	docloopAdapter.ready
					.then( () => {

						docloopAdapter.should.have.property('core', 					docloopCore)	
						docloopAdapter.should.have.property('id', 						adapter_config.id)	
						docloopAdapter.should.have.property('name', 					adapter_config.name)	
						docloopAdapter.should.have.property('type', 					adapter_config.type)	
						docloopAdapter.should.have.property('endpointClass', 			adapter_config.endpointClass)	
						docloopAdapter.should.have.property('endpointDefaultConfig')	
						docloopAdapter.should.have.property('app')	
						docloopAdapter.should.have.property('endpoints')	

						docloopAdapter.app._router.stack
						.filter( 	item => item.route)
						.forEach( 	item => {
												Object.keys(item.route.methods).forEach( key => {
													if(item.route.methods[key]) actual_routes.push([key.toUpperCase(), item.route.path])
												})
											}
						)

						actual_routes.should.deep.equal(expected_routes)

					})
					should.be.fulfilled
		})



	})



	describe("._getSessionData", function(){

		it("should throw an error if no session is provided", function(){

			should.Throw( () => docloopAdapter._getSessionData(), 		ReferenceError)
			should.Throw( () => docloopAdapter._getSessionData({}), 	TypeError)
			should.Throw( () => docloopAdapter._getSessionData(123), 	TypeError)
			should.Throw( () => docloopAdapter._getSessionData(null),	TypeError)
			should.Throw( () => docloopAdapter._getSessionData(true), 	TypeError)
		})


		it("should return the adapters session data", function(){
			var session_data 	= undefined

			session_data = 	docloopAdapter._getSessionData(new function Session(){})
			session_data.should.deep.equal({})

			session_data = 	docloopAdapter._getSessionData(new function Session(){ 
								this.adapters = {
										'test-adapter':		{test:'abc'},
										'another-adapter':  {blub:'xyz'}
								}
							})

			session_data.should.deep.equal({test:'abc'})
		})


	})



	describe("._clearSessionData", function(){

		it("should throw an error if no session is provided", function(){

			should.Throw( () => docloopAdapter._clearSessionData(), 		ReferenceError)
			should.Throw( () => docloopAdapter._clearSessionData({}), 		TypeError)
			should.Throw( () => docloopAdapter._clearSessionData(123), 		TypeError)
			should.Throw( () => docloopAdapter._clearSessionData(null),		TypeError)
			should.Throw( () => docloopAdapter._clearSessionData(true), 	TypeError)

		})


		it("should clear the adapters session data", function(){
			var session_data 	=  new function Session(){ 
										this.adapters = {
												'test-adapter':		{test:'abc'},
												'another-adapter':  {blub:'xyz'}
										}
									}

			docloopAdapter._clearSessionData(session_data)
			
			session_data.should.deep.equal({
				adapters:{
					'test-adapter':		{},
					'another-adapter': 	{blub:'xyz'}
				}
			})
		})


	})



	describe("._getEndpoints", function(){
		it("should call .getEndpoints with session data", function(){
			var session_data = {}

			sinon.stub(docloopAdapter,'getEndpoints')
			sinon.stub(docloopAdapter,'_getSessionData').returns(session_data)

			return	docloopAdapter._getEndpoints()
					.then( () => {
						docloopAdapter.getEndpoints.should.have.been.calledWith(session_data)
					})
					.should.be.fulfilled

		})

	})

	

	describe("._getStoredEndpoint", function(){
		it("should call .getEndpoint with session data", function(){
			var session_data = {}

			sinon.stub(docloopAdapter,'getStoredEndpoint')
			sinon.stub(docloopAdapter,'_getSessionData').returns(session_data)

			return	docloopAdapter._getStoredEndpoint()
					.then( () => {
						docloopAdapter.getStoredEndpoint.should.have.been.calledWith(session_data)
					})
					.should.be.fulfilled

		})

	})


	describe("._getStoredEndpoints", function(){

		it("should call .getStoredEndpoints with session data", function(){
			var session_data = {}

			sinon.stub(docloopAdapter,'getStoredEndpoints')
			sinon.stub(docloopAdapter,'_getSessionData').returns(session_data)

			return	docloopAdapter._getStoredEndpoints()
					.then( () => {
						docloopAdapter.getStoredEndpoints.should.have.been.calledWith(session_data)
					})
					.should.be.fulfilled

		})

	})



	describe("._getStoredEndpoints", function(){
		it("should call .getStoredEndpoints with session data", function(){
			var session_data = {}

			sinon.stub(docloopAdapter,'getStoredEndpoints')
			sinon.stub(docloopAdapter,'_getSessionData').returns(session_data)

			return	docloopAdapter._getStoredEndpoints()
					.then( () => {
						docloopAdapter.getStoredEndpoints.should.have.been.calledWith(session_data)
					})
					.should.be.fulfilled

		})

	})



	describe("._getData", function(){

		it("should throw an error if no session is provided", function(){

			return Promise.all([
				docloopAdapter._getData().should.be.rejectedWith(ReferenceError),
				docloopAdapter._getData({}).should.be.rejectedWith(TypeError),
				docloopAdapter._getData(123).should.be.rejectedWith(TypeError),
				docloopAdapter._getData(null).should.be.rejectedWith(TypeError),
				docloopAdapter._getData(true).should.be.rejectedWith(TypeError)
			])
		})


		it("should return set of adapter data", function(){
			var auth_data = {}

			sinon.stub(docloopAdapter, '_getAuthState').returns(Promise.resolve(auth_data))

			return 	docloopAdapter._getData(new function Session(){})
					.then( data => {
						data.should.have.property('id').that.is.a('string')
						data.should.have.property('name').that.is.a('string')
						data.should.have.property('type').that.is.a('string')
						data.should.have.property('id').that.is.a('string')
						data.should.have.property('extraEndpoints').that.is.a('boolean')
						data.should.have.property('endpointDefaultConfig').that.is.a('object')
						data.should.have.property('auth')

						data.auth.should.equal(auth_data)

					})
		})

	})



	describe("._handleGetRequest", function(){

		it("should send adapter data", function(){
			var data = {}

			sinon.stub(docloopAdapter, '_getData').returns(data)

			return 	docloopAdapter._handleGetRequest(req, res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledWith(data)
					})
		})

	})



	describe("._handleGetEndpointsRequest", function(){

		it("should send adapter data", function(){
			var data	= {},
				array 	= Array(10).fill({export:data})
			

			sinon.stub(docloopAdapter, '_getEndpoints').returns(array)

			return 	docloopAdapter._handleGetEndpointsRequest(req, res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledOnce
						res.send.lastCall.args[0].should.deep.equal(Array(10).fill(data))
					})
		})


	})



	describe("._handleGetGuessEndpointRequest", function(){

		it("should throw a DocloopError if input string is missing", function(){
			return	docloopAdapter._handleGetGuessEndpointRequest(req,res)
					.should.be.rejectedWith(DocloopError)
		})

		it("should send guessed enpoint data", function(){

			var data = {}

			sinon.stub(docloopAdapter.endpointClass,'guess').returns({export:data})

			return	docloopAdapter._handleGetGuessEndpointRequest({params:{str:'abc'}}, res)
					.then( () => {
						res.status.should.have.been.calledWith(200)
						res.send.should.have.been.calledWith(data)
						docloopAdapter.endpointClass.guess.restore()
					})
					.should.be.fulfilled

		})


	})



	describe(".getStoredEndpoints", function(){

		it("should throw ReferenceError if id is missing", function(){
			return 	docloopAdapter.getStoredEndpoint()
					.should.be.rejectedWith(ReferenceError)
		})


		it("should throw DocloopError if endpoint cannot be found", function(){
			return 	docloopAdapter.getStoredEndpoint('507f1f77bcf86cd799439011')
					.should.be.eventually.rejectedWith(DocloopError).with.property('status', 404)
		})

		it("should be rejected if a matching endpoint wont validate", function(){
			sinon.stub(docloopAdapter.endpoints,'findOne').returns(endpoint_data)
			sinon.stub(docloopAdapter.endpointClass.prototype,'validate').returns(Promise.reject(new Error()))

			return 	docloopAdapter.getStoredEndpoint('507f1f77bcf86cd799439011')
					.should.be.rejected
					.then( () => {
						docloopAdapter.endpointClass.prototype.validate.should.have.been.calledOnce
						docloopAdapter.endpointClass.prototype.validate.restore()
					})

		})


		it("should return matching endpoint", function(){
			sinon.stub(docloopAdapter.endpoints,'findOne').returns(endpoint_data)
			sinon.stub(docloopAdapter.endpointClass.prototype,'validate').returns(Promise.resolve())

			return 	docloopAdapter.getStoredEndpoint('507f1f77bcf86cd799439011')
					.then( endpoint => {
						endpoint.should.be.instanceOf(docloopAdapter.endpointClass)
						endpoint.export.identifier.should.deep.equal(endpoint_data.identifier)
						docloopAdapter.endpointClass.prototype.validate.should.have.been.calledOnce
						docloopAdapter.endpointClass.prototype.validate.restore()
					})
					.should.be.fulfilled
		})


	})



	describe(".newEndpoint", function(){

		it("should return a new instance of .endpointClass", function(){
			

			var endpoint = docloopAdapter.newEndpoint(endpoint_data)

			endpoint.should.be.an.instanceOf(docloopAdapter.endpointClass)
			endpoint.identifier.should.deep.equal(endpoint_data.identifier)
		})

	
	})




	describe(".getEndpoints", function(){

		it("should throw a DocloopError", function(){
			return 	docloopAdapter.getEndpoints()
					.should.be.rejectedWith(DocloopError)
		})

	})


	describe(".getStoredEndpoints", function(){

		it("should throw a DocloopError", function(){
			return 	docloopAdapter.getStoredEndpoints()
					.should.be.rejectedWith(DocloopError)
		})

	})


	describe(".getAuthState", function(){

		it("should throw a DocloopError", function(){
			return 	docloopAdapter.getAuthState()
					.should.be.rejectedWith(DocloopError)
		})

	})




})