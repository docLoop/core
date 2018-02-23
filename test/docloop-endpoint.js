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
		endpoint_data	=	{
								id:"107f1f77bcf86cd799439012", 
								identifier: { adapter: 'test-adapter'},
							}, 

		docloopAdapter 	=	undefined,
		docloopEndpoint	=	undefined,

		req				=	{
								session: new function Session(){}
							},
		res				=	{}



res.status	= 	sinon.stub().returns(res),
res.send	=	sinon.stub().returns(res)



describe("DocloopEndpoint", function(){

	beforeEach(function(){
		docloopAdapter  = new DocloopAdapter(docloopCore, adapter_config)
		docloopEndpoint = new DocloopEndpoint(docloopAdapter, endpoint_data) 
	})


	describe(".constructor", function(){

		it("should throw errors if misconfigured", function(){
			should.Throw( () => new DocloopEndpoint(), ReferenceError)
			should.Throw( () => new DocloopEndpoint(docloopAdapter), ReferenceError)
			should.Throw( () => new DocloopEndpoint(docloopAdapter, {identifier:{}}), ReferenceError)
			should.Throw( () => new DocloopEndpoint(docloopAdapter, {identifier:{adapter:'bad-adapter'}}), DocloopError)
		})


		it("should have all the properties with default", function(){
			docloopEndpoint.should.have.property('adapter').that.is.an.instanceOf(DocloopAdapter)
			
			docloopEndpoint.should.have.property('id')
			docloopEndpoint.id.should.have.property('_bsontype')
			docloopEndpoint.id._bsontype.should.equal('ObjectID')

			docloopEndpoint.should.have.a.property('identifier').that.is.an('object')
			docloopEndpoint.identifier.should.deep.equal(endpoint_data.identifier)

			docloopEndpoint.should.have.a.property('config').that.is.an('object')
			docloopEndpoint.config.should.deep.equal({})

			docloopEndpoint.should.have.a.property('decor').that.is.an('object')
			docloopEndpoint.decor.should.deep.equal({image:	null, title: 'Generic endpoint', details:'unknown'})

		})

		it("should have all the properties including custom decor and custom config", function(){
			var decor 	= {},
				config 	= {}

			docloopEndpoint = new DocloopEndpoint(docloopAdapter,{...endpoint_data, decor, config })


			docloopEndpoint.should.have.a.property('config').that.is.an('object')
			docloopEndpoint.config.should.equal(config)

			docloopEndpoint.should.have.a.property('decor').that.is.an('object')
			docloopEndpoint.decor.should.equal(decor)

		})


	})



	describe(".guess <static>", function(){

		it("should throw a DocloopError", function(){
			return 	DocloopEndpoint.guess()
					.should.be.rejectedWith(DocloopError)
		})

	})

	
	describe(".export", function(){

		it("should return endpoint data", function(){
			docloopEndpoint.export.should.deep.equal({
				identifier: docloopEndpoint.identifier,
				config:		docloopEndpoint.config,
				decor:		docloopEndpoint.decor
			})
			
		})

	})


	describe(".skeleton", function(){

		it("should return an endpoint skeleton", function(){
			docloopEndpoint.skeleton.should.deep.equal({
				id:			docloopEndpoint.id,
				adapter: 	docloopEndpoint.identifier.adapter
			})
		})

	})


	describe(".store", function(){

		it("should store endpoint data to the database", function(){
			sinon.stub(docloopEndpoint.adapter.endpoints,'insertOne').returns(Promise.resolve({insertedId:'abc'}))

			return	docloopEndpoint.store()
					.then( insertedId => {
						insertedId.should.equal('abc')
						docloopAdapter.endpoints.insertOne.lastCall.args[0].should.deep.equal(docloopEndpoint.export)
						docloopAdapter.endpoints.insertOne.restore()
					})
					.should.be.fulfilled
		})

	})


	describe(".update", function(){

		it("should throw a DocloopError if no id is present", function(){
			docloopEndpoint.id = undefined
			return 	docloopEndpoint.update()
					.should.be.rejectedWith(DocloopError)
		})

		it("should throw an error if no matching document was found", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:0})

			return 	docloopEndpoint.update()
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})

		it("should update matching document with export data", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1})

			return	docloopEndpoint.update()
					.then( () => {
						docloopAdapter.endpoints.update.should.have.been.calledOnce
						docloopAdapter.endpoints.update.lastCall.args.should.deep.equal([
							{_id: 	docloopEndpoint.id},
							{ $set: docloopEndpoint.export}
						])						
					})
					.should.be.fulfilled
		})

		it("should throw an error if writing the document failed", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1, writeError: true})

			return 	docloopEndpoint.update()
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})


		it("should throw an error if writing(concern) the document failed", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1, writeConcernError: true})

			return 	docloopEndpoint.update()
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})


	})

	describe(".setData", function(){

		it("should throw errors if called with bad arguments", function(){
			return 	Promise.all([
						docloopEndpoint.setData().should.be.rejectedWith(ReferenceError),
						docloopEndpoint.setData(123).should.be.rejectedWith(TypeError),
						docloopEndpoint.setData(null).should.be.rejectedWith(TypeError),
						docloopEndpoint.setData({}).should.be.rejectedWith(TypeError),
						docloopEndpoint.setData([]).should.be.rejectedWith(TypeError),
						docloopEndpoint.setData('test-key').should.be.rejectedWith(ReferenceError),
					])
		})

		it("should throw a DocloopError if no id is present", function(){
			docloopEndpoint.id = undefined
			return 	docloopEndpoint.setData('test-key', 'test-data')
					.should.be.rejectedWith(DocloopError)
		})

		it("should throw an error if no matching document was found", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:0})

			return 	docloopEndpoint.setData('test-key', 'test-data')
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})

		it("should update data property on matching document with provided data", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1})

			return	docloopEndpoint.setData('test-key', 'test-data')
					.then( () => {
						docloopAdapter.endpoints.update.should.have.been.calledOnce
						docloopAdapter.endpoints.update.lastCall.args.should.deep.equal([
							{_id: 	docloopEndpoint.id},
							{ $set: {'data.test-key': 'test-data'}}
						])						
					})
					.should.be.fulfilled
		})

		it("should throw an error if writing the document failed", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1, writeError: true})

			return 	docloopEndpoint.setData('test-key', 'test-data')
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})


		it("should throw an error if writing(concern) the document failed", function(){
			sinon.stub(docloopAdapter.endpoints,'update').returns({nMatched:1, writeConcernError: true})

			return 	docloopEndpoint.setData('test-key', 'test-data')
					.should.be.rejectedWith(Error)
					.then( () => docloopAdapter.endpoints.update.should.have.been.calledOnce )
		})

	})


	describe(".getData", function(){


		it("should throw errors if called with bad arguments", function(){
			return 	Promise.all([
						docloopEndpoint.getData().should.be.rejectedWith(ReferenceError),
						docloopEndpoint.getData(123).should.be.rejectedWith(TypeError),
						docloopEndpoint.getData(null).should.be.rejectedWith(TypeError),
						docloopEndpoint.getData({}).should.be.rejectedWith(TypeError),
						docloopEndpoint.getData([]).should.be.rejectedWith(TypeError),
					])
		})


		it("should throw a DocloopError if no id is present", function(){
			docloopEndpoint.id = undefined
			return 	docloopEndpoint.getData('test-key')
					.should.be.rejectedWith(DocloopError)
		})


		it("should retrieve	data stored with the endpoint", function(){
			sinon.stub(docloopAdapter.endpoints,'findOne').returns({data:{key:{subkey:'test-data'}}})

			return	docloopEndpoint.getData('key.subkey')
					.then( data => data.should.equal('test-data'))
					.should.be.fulfilled

		})

	})

	describe(".remove", function(){


		it("should throw a DocloopError if no id is present", function(){
			docloopEndpoint.id = undefined
			return 	docloopEndpoint.remove('test-key')
					.should.be.rejectedWith(DocloopError)
		})

		it("should throw an error if removal faled", function(){
			sinon.stub(docloopAdapter.endpoints,'deleteOne').returns({result:{n:0}})

			return	docloopEndpoint.remove()
					.should.be.rejectedWith(DocloopError)
					.then( () => {
						docloopAdapter.endpoints.deleteOne.should.have.been.calledOnce
						docloopAdapter.endpoints.deleteOne.lastCall.args.should.deep.equal([{_id:  docloopEndpoint.id}])
					})
		})

	})



	describe("._validate", function(){

		it("should call .validate with session data", function(){
			var session_data = {},
				session		 = new function Session(){}

			sinon.stub(docloopAdapter,'_getSessionData').returns(session_data)
			sinon.stub(docloopEndpoint,'validate').returns(session_data)

			return	docloopEndpoint._validate(session)
					.then( () => {
						docloopAdapter._getSessionData.should.have.been.calledWith(session)
						docloopEndpoint.validate.should.have.been.calledWith(session_data)
					})
					.should.be.fulfilled

		})

	})


	describe(".validate", function(){

		it("should throw a DocloopError", function(){
			return	docloopEndpoint.validate()
					.should.be.rejectedWith(DocloopError)
		})

	})


	describe(".updateDecor", function(){

		it("should throw a DocloopError", function(){
			return	docloopEndpoint.updateDecor()
					.should.be.rejectedWith(DocloopError)
		})

	})


	describe(".match", function(){

		it("should throw an error if called with bad arguments", function(){
			should.Throw( () => docloopEndpoint.match(),					DocloopError)
			// should.Throw( () => docloopEndpoint.match(null),				DocloopError)
			// should.Throw( () => docloopEndpoint.match({identifier:null}),	DocloopError)
		})

		it("should match with itself", function(){
			docloopEndpoint.match(docloopEndpoint).should.be.true
					
		})

		it("should match with own identifier", function(){
			docloopEndpoint.match(docloopEndpoint.identifier).should.be.true
		})		

		it("should match with different endpoint that has the same identifier", function(){
			docloopEndpoint.match(new DocloopEndpoint(docloopAdapter, {identifier: docloopEndpoint.identifier})).should.be.true
		})

	})

})
	