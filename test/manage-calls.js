'use strict'


//TODO: Test calls with arguments
//Todo: Test cleanUp

var chai			=	require('chai'),
	chaiAsPromised 	= 	require("chai-as-promised"),
	should 			= 	chai.should(),
	sinon			=	require('sinon'),
	sinonChai 		= 	require("sinon-chai"),
	manageCalls		= 	require('../manage-calls.js'),
	serialize		=	manageCalls.serialize,
	collate			=	manageCalls.collate,
	cache			=	manageCalls.cache,
	Promise			= 	require('bluebird')

chai.use(chaiAsPromised)
chai.use(sinonChai)

var	delay			= 	160,
	timeout			=	delay/2,
	testObj			=	{
							nonFunction:	"this is not a function",
							testAsync:		sinon.stub().callsFake(function(x, d){
												return Promise.delay(d||delay).then( () => x)
											})
						},
	originalAsync 	= 	testObj.testAsync



describe("manageCalls", function(){

	describe('.serialize', function(){

		it('should throw an error if argument yields no function', function(){
			should.Throw( () => serialize(testObj, 'x'), 					TypeError)
			should.Throw( () => serialize(testObj, 'nonFunction'), 			TypeError)

			should.Throw( () => serialize(testObj, ['x', 'nonFunction']),	TypeError)
		})



		it('should replace the original method', function(){
			serialize(testObj, 'testAsync')
			testObj.testAsync.should.not.equal(originalAsync)

			testObj.testAsync.restore()
			testObj.testAsync.should.equal(originalAsync)
		})



		describe('proxy method', function(){

			var clock
			
			before(function(){
				serialize(testObj, 'testAsync')
				clock = sinon.useFakeTimers()
			})

			after(function(){
				testObj.testAsync.restore()
				clock.restore()
			})


			it('should return a promise', function(){
				testObj.testAsync(123).should.be.an.instanceof(Promise)
				clock.runAll() 
			})


			it('should resolve in call order', function(){
				
				var result = []

				Promise.all([
					testObj.testAsync(3, 200).then( x => result.push(x)),
					testObj.testAsync(1, 100).then( x => result.push(x)),
					testObj.testAsync(2,  50).then( x => result.push(x))
				])
				.then( () => {
					result.should.deep.equal([3,1,2])
				})
				
				clock.runAll() 
			})




		})


	})


	describe('.collate', function(){

		it('should throw an error if argument yields no function', function(){
			should.Throw( () => collate(testObj, 'x') )
			should.Throw( () => collate(testObj, 'nonFunction') )
		})


		it('should replace the original method', function(){
			collate(testObj, 'testAsync', timeout)
			testObj.testAsync.should.not.equal(originalAsync)

			testObj.testAsync.restore()
			testObj.testAsync.should.equal(originalAsync)
		})


		describe('replacement method', function(){

			beforeEach(function(){
				collate(testObj, 'testAsync', timeout)
				originalAsync.resetHistory()
			})


			afterEach(function(){
				testObj.testAsync.restore()
			})

			

			it('should return a promise', function(){
				var p = testObj.testAsync()

				p.should.be.an.instanceof(Promise)
				
				return p
			})


			it('should collate multiple calls', function(){
				var results = [] 

				return 	Promise.all([
							Promise.delay(0*delay/10).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(1*delay/10).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(2*delay/10).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(3*delay/10).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(4*delay/10).then( () => testObj.testAsync({})).then( r => results.push(r) ),

							Promise.delay(1*delay/10).then( () => testObj.testAsync(1))
						])
						.then( () => originalAsync.should.have.been.calledTwice )
						.then( () => testObj.testAsync({}).then( r => results.push(r) ) )
						.then( () => {

							originalAsync.should.have.been.calledThrice

							results[0].should.equal(results[1])
							results[1].should.equal(results[2])
							results[2].should.equal(results[3])
							results[3].should.equal(results[4])
							
							results[4].should.not.equal(results[5])
						})
				
			})

			it('should call original method again after timeout', function(){

				var test_value = {}

				return 	Promise.all([
							testObj.testAsync({}),
							testObj.testAsync(test_value),
							testObj.testAsync(test_value),
							testObj.testAsync(test_value)
						])
						.delay( timeout )
						.then( ()	=> testObj.testAsync(test_value) )
						.then( ()	=> originalAsync.should.have.been.calledTwice)
			})


		})


	})






	describe('.cache', function(){

		it('should throw an error if argument yields no function', function(){
			should.Throw( () => cache(testObj, 'x') )
			should.Throw( () => cache(testObj, 'nonFunction') )
		})


		it('should replace the original method', function(){
			cache(testObj, 'testAsync')
			testObj.testAsync.should.not.equal(originalAsync)

			testObj.testAsync.restore()
			testObj.testAsync.should.equal(originalAsync)
		})


		describe('replacement method', function(){


			beforeEach(function(){
				cache(testObj, 'testAsync', 200)
				originalAsync.resetHistory()
			})



			afterEach(function(){
				testObj.testAsync.restore()
			})


			it("should cache multiple calls", function(){
				var results = [] 

				return 	Promise.all([
							Promise.delay(50).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(40).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(30).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(20).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							Promise.delay(10).then( () => testObj.testAsync({})).then( r => results.push(r) ),
							
							Promise.delay(25).then( () => testObj.testAsync(1))
						])
						.then( () => originalAsync.should.have.been.calledTwice )
						.then( () => testObj.testAsync({}).then( r => results.push(r) ) )
						.then( () => {

							originalAsync.should.have.been.calledTwice

							results[0].should.equal(results[1])
							results[1].should.equal(results[2])
							results[2].should.equal(results[3])
							results[3].should.equal(results[4])
							results[4].should.equal(results[5])
						})
						.then( () => Promise.delay(150) )
						.then( () => testObj.testAsync({}).then( r => results.push(r) ) )
						.then( () => originalAsync.should.have.been.calledThrice )
			})

		})	

	})


})