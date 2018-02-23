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
		docloopCore		=	new DocloopCore(config),
		adapter_config	=	{
								id:				'test-adapter', 
								type:			'source', 
								name:			'TestAdapter',
								endpointClass:	DocloopEndpoint,
								extraEndpoints:	false,
							},

		source_data_1		=	{
								id:"107f1f77bcf86cd799439012", 
								identifier: { adapter: 'test-adapter' },
								config: { test: 'A1'},
								decor: {test:'A2'}
							}, 
		target_data_1		=	{
								id:"407f1f77bcf86cd7994390bb", 
								identifier: { adapter: 'test-adapter' },
								config: { test: 'B1'},
								decor: {test:'B2'}
							},
		source_data_2	=	{id:"207f1f77bcf86cd7994390cc", identifier: { adapter: 'test-source-adapter'}}, 
		target_data_2	=	{id:"407f1f77bcf86cd7994390dd", identifier: { adapter: 'test-target-adapter'}},

		id				=	'407f1f77bcf86cd799439aaa',

		docloopAdapter	=	undefined,
		docloopLink		=	undefined,
		req				=	{
								session: new function Session(){}
							},
		res				=	{}



res.status	= 	sinon.stub().returns(res),
res.send	=	sinon.stub().returns(res)

docloopCore.use(DocloopAdapter, adapter_config)
docloopAdapter = docloopCore.adapters['test-adapter']

describe('DocloopLink', function(){


	beforeEach(function(){
		docloopLink		=	new DocloopLink(docloopCore, {id, source: source_data_1, target: target_data_1})
	})





	describe(".constructor", function(){

		it("should throw errors if misconfigured", function(){

			should.Throw( () => new DocloopLink(), 				ReferenceError)
			should.Throw( () => new DocloopLink({}), 			TypeError)
			should.Throw( () => new DocloopLink(123), 			TypeError)
			should.Throw( () => new DocloopLink([]), 			TypeError)
			should.Throw( () => new DocloopLink('abc'),			TypeError)
			should.Throw( () => new DocloopLink(null),			TypeError)

			should.Throw( () => new DocloopLink(docloopCore),	ReferenceError)

		})


	})

			
	describe(".importData", function(){

		it("should throw errors if called with bad arguennts", function(){
			should.Throw( () => docloopLink.importData(), 							ReferenceError)
			should.Throw( () => docloopLink.importData(null), 						TypeError)
			should.Throw( () => docloopLink.importData({}), 						ReferenceError)
			should.Throw( () => docloopLink.importData({source:{}}), 				ReferenceError)
			should.Throw( () => docloopLink.importData({source:{}, target:{}}), 	ReferenceError)

			should.Throw( () => docloopLink.importData({
				source:{identifier:{}},
				target:{}
			}), ReferenceError)


			should.Throw( () => docloopLink.importData({
				source:{identifier:{}},
				target:{identifier:{}}
			}), DocloopError)


			should.Throw( () => docloopLink.importData({
				source:{identifier:{adapter: 'bad-adapter'}},
				target:{identifier:{}}
			}), DocloopError)


			should.Throw( () => docloopLink.importData({
				source:{identifier:{adapter: 'bad-adapter'}},
				target:{identifier:{adapter: 'bad-adapter'}}
			}), DocloopError)

			should.Throw( () => docloopLink.importData({
				source:{identifier:{adapter: 'test-adapter'}},
				target:{identifier:{adapter: 'bad-adapter'}}
			}), DocloopError)
		})


		it("should set source and target", function(){

			var fake_endpoint = {}

			sinon.stub(docloopAdapter,'newEndpoint').returns({export:fake_endpoint})

			var source_data_1 = 	{
									identifier:{
										adapter: 	'test-adapter',
										test:		'A1'
									},
								},
				target_data_1 =	{
									identifier:{
										adapter: 	'test-adapter',
										test:		'B2'
									},
								}

			docloopLink.importData({target:target_data_1, source:source_data_1})

			docloopLink.export.source.should.equal(fake_endpoint)
			docloopLink.export.target.should.equal(fake_endpoint)

			docloopAdapter.newEndpoint.restore()

		})


	})


	describe(".export", function(){

		it("should return raw data", function(){

			docloopLink.export.source.should.deep.equal(docloopLink.source.export)
			docloopLink.export.target.should.deep.equal(docloopLink.target.export)

		})


	})

	describe(".skeleton", function(){

		it("should return minimal link data", function(){
			docloopLink.skeleton.id.toString().should.equal(id)

			docloopLink.skeleton.source.should.deep.equal(docloopLink.source.skeleton)
			docloopLink.skeleton.target.should.deep.equal(docloopLink.target.skeleton)
		})

	})


	describe(".preventDuplicate", function(){

		it("should throw a DocloopError|409 if a link with the same source and target identifier already exists.", function(){
			
			var find_endpoints = sinon.stub(docloopAdapter.endpoints,'find')


			find_endpoints.returns({
				toArray: () => 	Promise.resolve([
									source_data_1,
									source_data_2,
									target_data_1,
									target_data_2
								])
			})

			sinon.stub(docloopCore.links,'find').returns({toArray: () => Promise.resolve([{}])})

			return docloopLink.preventDuplicate()
					.should.eventually.be.rejectedWith(DocloopError).that.has.property('status', 409)
					.then( () => {
						find_endpoints.should.have.been.calledTwice
						find_endpoints.restore() 

						docloopCore.links.find.should.have.been.calledOnce
						docloopCore.links.find.restore()
					})
		})




		it("should prematurely resolve if no stored sources are available for the source adapter", function(){
			
			var find_endpoints = sinon.stub(docloopAdapter.endpoints,'find')

			find_endpoints.onFirstCall().returns({
				toArray: () => 	Promise.resolve([])
			})
			
			find_endpoints.onSecondCall().returns({
				toArray: () => 	Promise.resolve([
									source_data_1,
									source_data_2,
									target_data_1,
									target_data_2
								])
			})
			
			sinon.stub(docloopCore.links,'find')

			return 	docloopLink.preventDuplicate()
					.then( () => {
						find_endpoints.should.have.been.calledTwice

						docloopCore.links.find.should.not.have.been.called

						find_endpoints.restore() 
						docloopCore.links.find.restore()
					})
					.should.be.fulfilled
		})



		it("should prematurely resolve if no stored targets are available for the target adapter", function(){
			
			var find_endpoints = sinon.stub(docloopAdapter.endpoints,'find')

			find_endpoints.onFirstCall().returns({
				toArray: () => 	Promise.resolve([
									source_data_1,
									source_data_2,
									target_data_1,
									target_data_2
								])
			})

			find_endpoints.onSecondCall().returns({
				toArray: () => 	Promise.resolve([])
			})


			sinon.stub(docloopCore.links,'find').returns({toArray: () => Promise.resolve([{}])})

			return 	docloopLink.preventDuplicate()
					.then( () => {
						find_endpoints.should.have.been.calledTwice

						docloopCore.links.find.should.not.have.been.called

						find_endpoints.restore() 
						docloopCore.links.find.restore()
					})
					.should.be.fulfilled
		})

	})


	describe(".store", function(){

		it("should store source and target first then the link skeleton", function(){
			sinon.stub(docloopLink.source,'store')
			sinon.stub(docloopLink.target,'store')

			sinon.stub(docloopCore.links,'insertOne').returns({insertedId:docloopLink.id})

			return 	docloopLink.store()
					.then( () => {
						docloopLink.source.store.should.have.been.calledOnce
						docloopLink.target.store.should.have.been.calledOnce

						docloopCore.links.insertOne.should.have.been.calledOnce
						docloopCore.links.insertOne.lastCall.args[0].should.deep.equal(docloopLink.skeleton)

						docloopLink.source.store.restore()
						docloopLink.target.store.restore()
						docloopCore.links.insertOne.restore()

					})
		})


	})


	describe(".update", function(){

		it("should call update on source and target", function(){
			sinon.stub(docloopLink.source,'update')
			sinon.stub(docloopLink.target,'update')

			return 	docloopLink.update()
					.then( () => {
						docloopLink.source.update.should.have.been.calledOnce
						docloopLink.target.update.should.have.been.calledOnce

						docloopLink.source.update.restore()
						docloopLink.target.update.restore()
					})
					.should.be.fulfilled
		})


	})


	describe(".remove", function(){

		it("should throw an error if id is missing", function(){
			delete docloopLink.id

			return	docloopLink.remove()
					.should.be.rejectedWith(ReferenceError)
		})

		it("should throw an error if removal was not successful", function(){
			sinon.stub(docloopLink.source,'remove')
			sinon.stub(docloopLink.target,'remove')

			sinon.stub(docloopCore.links,'deleteOne').returns({result:{n:0}})

			return 	docloopLink.remove()
					.should.be.rejectedWith(DocloopError)
					.then( () => {
						docloopLink.source.remove.should.have.been.calledOnce
						docloopLink.target.remove.should.have.been.calledOnce

						docloopLink.source.remove.restore()
						docloopLink.target.remove.restore()

						docloopCore.links.deleteOne.should.have.been.calledOnce
						docloopCore.links.deleteOne.restore()
					})
		})

		it("should call remove on source and target and then remove the link", function(){
			sinon.stub(docloopLink.source,'remove')
			sinon.stub(docloopLink.target,'remove')

			sinon.stub(docloopCore.links,'deleteOne').returns({result:{n:1}})

			return 	docloopLink.remove()
					.then( () => {
						docloopLink.source.remove.should.have.been.calledOnce
						docloopLink.target.remove.should.have.been.calledOnce

						docloopLink.source.remove.restore()
						docloopLink.target.remove.restore()

						docloopCore.links.deleteOne.should.have.been.calledOnce
						docloopCore.links.deleteOne.restore()
					})
					.should.be.fulfilled
		})


	})


	describe("._validate", function(){

		it("should throw a DocloopError if source fails to validate", function(){
			sinon.stub(docloopLink.source,'_validate').returns(Promise.reject())
			sinon.stub(docloopLink.target,'_validate').returns(Promise.resolve())

			return 	docloopLink._validate()
					.should.be.rejectedWith(DocloopError)
		})

		it("should throw a DocloopError if source fails to validate", function(){
			sinon.stub(docloopLink.source,'_validate').returns(Promise.resolve())
			sinon.stub(docloopLink.target,'_validate').returns(Promise.reject())

			return 	docloopLink._validate()
					.should.be.rejectedWith(DocloopError)
		})

		it("should resolve if both source and target validate", function(){
			sinon.stub(docloopLink.source,'_validate').returns(Promise.resolve())
			sinon.stub(docloopLink.target,'_validate').returns(Promise.resolve())

			return 	docloopLink._validate()
					.should.be.fulfilled
		})

	})

})



