'use strict'

console.log('TODO: hrow errorrs')

//TODO: reason for abandon

var chai			=	require('chai'),
	chaiAsPromised 	= 	require("chai-as-promised"),
	should 			= 	chai.should(),
	sinon			=	require('sinon'),
	sinonChai 		= 	require("sinon-chai"),
	EventQueue		= 	require('../event-queue.js'),
	Promise			= 	require('bluebird'),
	MongoClient 	= 	require('mongodb').MongoClient,
	collection		= 	undefined


chai.use(chaiAsPromised)
chai.use(sinonChai)


function testEventQueueWithConfig(config){

	var testQueue 			= new EventQueue(config),
		attemptListener_1 	= sinon.spy(),
		attemptListener_2 	= sinon.spy(),
		attemptListener_3 	= sinon.spy(),
		attemptListener_4 	= sinon.spy(),
		failListener_1		= sinon.spy(),
		failListener_2		= sinon.spy(),
		failListener_3		= sinon.spy(),
		failListener_4		= sinon.spy(),
		doneListener_1		= sinon.spy()

	testQueue.on('test-event-1-attempt', attemptListener_1)
	testQueue.on('test-event-2-attempt', attemptListener_2)
	testQueue.on('test-event-3-attempt', attemptListener_3)
	testQueue.on('test-event-4-attempt', attemptListener_4)
	
	testQueue.on('test-event-1-fail', 	failListener_1)
	testQueue.on('test-event-2-fail', 	failListener_2)
	testQueue.on('test-event-3-fail', 	failListener_3)
	testQueue.on('test-event-4-fail', 	failListener_4)

	testQueue.on('test-event-1-done',	doneListener_1)

	return function(){

		beforeEach(function(){
			attemptListener_1.reset()
			attemptListener_2.reset()
			attemptListener_3.reset()
			attemptListener_4.reset()

			failListener_1.reset()
			failListener_2.reset()
			failListener_3.reset()
			failListener_4.reset()

			doneListener_1.reset()

		})

		describe('methods', function(){
			it('should include .add', 			function(){ testQueue.should.respondTo('add') })
			it('should include .process', 		function(){ testQueue.should.respondTo('process') })
			it('should include .start', 		function(){ testQueue.should.respondTo('start') })
			it('should include .stop', 			function(){ testQueue.should.respondTo('stop') })
			it('should include .clear', 		function(){ testQueue.should.respondTo('clear') })
			it('should include ._getDelay', 	function(){ testQueue.should.respondTo('_getDelay') })
		})

		describe('._getDelay', function(){

			it('should map 0 to 0', function(){
				testQueue._getDelay(0).should.equal(0)
			})

			it('should map 1 to something > 0', function(){
				testQueue._getDelay(1).should.be.greaterThan(0)
			})

		})

		describe('.start/.stop', function(){

			before(function(){
				sinon.spy(testQueue, 'process')				
			})

			after(function(){
				testQueue.process.restore()
			})

			it('should start/stop interval for .process', function(){
				testQueue.start()

				return 	Promise.resolve()
						.delay(testQueue.processInterval*2.5)
						.then( () => testQueue.stop() )
						.delay(testQueue.processInterval*2.5)
						.then( () => testQueue.process.should.have.been.calledTwice)
			})
		})

		describe('.add', function(){


			before(function(){
				testQueue.clear()
			})

			after(function(){				
				testQueue.clear()
			})


			it('should add an event to the queue and trigger attempt event', function(){
				

				return 	testQueue.add('test-event-1')
						.then( () => {
							attemptListener_1.should.have.been.calledOnce
							return collection.find({eventName:'test-event-1'}).toArray().should.eventually.have.property('length', 1)
						})

			})

			it('should not add an event twice, but reset the original one, and trigger .attempt twice', function(){
				return 	Promise.resolve()
						.then( ()	=>	testQueue.add('test-event-2') )
						.then( ()	=>	testQueue.add('test-event-2') )
						.then( () 	=>	{
							attemptListener_2.should.have.been.calledTwice
							return collection.find({eventName:'test-event-2'}).toArray().should.eventually.have.property('length', 1)
						})						
			})



		})








		describe('.process', function(){

			before(function(){

			})
		

			beforeEach(function(){

				return 	Promise.resolve()
						.then( () => testQueue.clear())
						.then( () => Promise.all([
							testQueue.add('test-event-1'),	
							testQueue.add('test-event-2'),	
							testQueue.add('test-event-3')
						]))
						.then( () => {
							attemptListener_1.reset()
							attemptListener_2.reset()
							attemptListener_3.reset()
						})
			})

			after(function(){
				testQueue.clear()
			})


			it('should not trigger attempt event if events are not yet due', function(){
				return 	Promise.resolve()
						.then( ()	=> testQueue.process() )
						.delay(testQueue._getDelay(1)/2)
						.then( ()	=> {
							attemptListener_1.should.not.have.been.called
							attemptListener_2.should.not.have.been.called
							attemptListener_3.should.not.have.been.called
						})

			})


			it('should trigger attempt event for every stored event that is due', function(){
				
				return 	Promise.resolve()
						.delay(testQueue._getDelay(1))
						.then( ()	=> testQueue.process() )
						.then( ()	=> {
							attemptListener_1.should.have.been.calledOnce
							attemptListener_2.should.have.been.calledOnce
							attemptListener_3.should.have.been.calledOnce
						})

			})

			it('should trigger fail event for every event that had too many attempts', function(){	

				var chain = Promise.resolve()

				Array(testQueue.maxRetries+1).fill(0).forEach( (item, index) => {
					chain = chain
							.delay(testQueue._getDelay(index+1)) 
							.then( () => testQueue.process() )
				})


				return chain.then( () => {
					failListener_1.should.have.been.calledOnce
					failListener_2.should.have.been.calledOnce
					failListener_3.should.have.been.calledOnce
				})

			})


			describe("QueuedEvent", function(){

			describe('.attempt', function(){

				var queued_event = undefined

				beforeEach(function(){

					return 	Promise.resolve()
							.then( () => testQueue.clear() )
							.then( () => testQueue.add('test-event-1') )
							.then( qe => {
								queued_event = qe
								attemptListener_1.reset() 
							})
				})

				after(function(){
					return testQueue.clear()
				})


				it('should trigger an attempt event ', function(){
					return	Promise.resolve()
							.then( () => queued_event.attempt() )
							.then( () => attemptListener_1.should.have.been.calledOnce )
				})	

				it('should increase number of attempts ', function(){
					return	Promise.resolve()
							.then( ()	=> collection.findOne({eventName:'test-event-1'}) )
							.then( item => item.attempts.should.equal(1) )
							.then( ()	=> queued_event.attempt() )
							.then( ()	=> collection.findOne({eventName:'test-event-1'}) )
							.then( item => item.attempts.should.equal(2) )
							.then( ()	=> queued_event.attempt() )
							.then( ()	=> collection.findOne({eventName:'test-event-1'}) )
							.then( item => item.attempts.should.equal(3) )
				})	


			})




			describe('abandon', function(){

				var queued_event = undefined

				beforeEach(function(){
					return 	Promise.resolve()
							.then( () => testQueue.clear() )
							.then( () => testQueue.add('test-event-1') )
							.then( qe => {
								queued_event = qe
								failListener_1.reset() 
							})
				})

				after(function(){
					return testQueue.clear()
				})



				it('should trigger a fail event ', function(){
					var error = new Error('TEST')

					return 	Promise.resolve()
							.then( () => queued_event.abandon(error) )
							.then( () => {
								failListener_1.should.have.been.calledOnce
								failListener_1.lastCall.args[0].reason.should.equal(error)
							})
				})	

				it('should remove the event from the queue', function(){
					return	Promise.resolve()
							.then( item => queued_event.abandon() ) 
							.then( ()	=> collection.findOne({eventName:'test-event-1'}) )
							.then( item	=> should.not.exist(item))
				})

			})

			describe('checkOff', function(){

				var queued_event = undefined

				beforeEach(function(){
					return 	Promise.resolve()
							.then( () => testQueue.clear() )
							.then( () => testQueue.add('test-event-1') )
							.then( qe => {
								queued_event = qe
								doneListener_1.reset() 
							})
				})

				after(function(){
					return testQueue.clear()
				})



				it('should trigger a done event ', function(){

					return 	Promise.resolve()
							.then( () => queued_event.checkOff() )
							.then( () => doneListener_1.should.have.been.calledOnce)
				})	

				it('should remove the event from the queue', function(){
					return	Promise.resolve()
							.then( item => queued_event.checkOff() ) 
							.then( ()	=> collection.findOne({eventName:'test-event-1'}) )
							.then( item	=> should.not.exist(item))
				})

			})
			
		})

		})


	}

}






MongoClient.connect('mongodb://localhost:27777/test')
.then( client => {
	collection 	= client.db('test').collection('event-queue')
})
.then(function(){

	describe('EventQueue', function(){

		it("should throw errors if miscondigured", function(){
			should.throw( () => new EventQueue())
			should.throw( () => new EventQueue( {} ))
		})



		describe('(config with fixed delay)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				50,
			maxRetries:			3,
			spread:				10,
			processInterval:	60,
		}))

		describe('(config with delay array)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				[20, 30, 40, 50],
			spread:				5,
			processInterval:	20,
		}))

		describe('(config with delay function)',	testEventQueueWithConfig({
			collection:			collection,
			delay:				(retry => retry*20),
			maxRetries:			5,
			spread:				5,
			processInterval:	40,
		}))
	})
})
.catch( (e) => { console.error(e); process.exit(1) })