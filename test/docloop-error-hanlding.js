
'use strict'


var		DocloopError		= 	require('../docloop-error-handling.js').DocloopError,
		catchAsyncErrors	=	require('../docloop-error-handling.js').catchAsyncErrors,
		chai				= 	require('chai'),
		chaiAsPromised 		= 	require('chai-as-promised'),
		should 				= 	chai.should(),
		sinon				= 	require('sinon'),
		sinonChai 			= 	require('sinon-chai')



describe("docloopErrorHandling", function(){


	describe("DocloopError", function(){

		it("should be an instance of Error", function(){
			new DocloopError().should.be.instanceOf(Error)		
		})

		it("should have a status code", function(){
			new DocloopError().should.have.property('status', 500)
			new DocloopError("test", 400).should.have.property('status', 400)
		})
		
	})

	describe(".catchAsyncErrors", function(){

		it("should call next() with an error, when original function throws an error", function(){
			var test_fn 	= sinon.stub().throws("Error"),
				wrapped_fn	= catchAsyncErrors(test_fn),
				next		= sinon.stub()

			return	wrapped_fn(null, null, next)
					.then( () => {
						test_fn.should.have.been.calledOnce
						next.should.have.been.calledOnce
						next.lastCall.args[0].should.be.instanceOf(Error)
					})

		})

		it("should call next() with an error, when original function returns a rejected promise", function(){
			var reason		= {},
				test_fn 	= sinon.stub().returns(Promise.reject(reason)),
				wrapped_fn	= catchAsyncErrors(test_fn),
				next		= sinon.stub()

			return	wrapped_fn(null, null, next)
					.then( () => {
						test_fn.should.have.been.calledOnce
						next.should.have.been.calledOnce
						next.lastCall.args[0].should.equal(reason)
					})

		})

		it("should not call next() with an error, when original function returns a resolved promise", function(){
			var reason		= {},
				test_fn 	= sinon.stub().returns(Promise.resolve(reason)),
				wrapped_fn	= catchAsyncErrors(test_fn),
				next		= sinon.stub()

			return	wrapped_fn(null, null, next)
					.then( () => {
						test_fn.should.have.been.calledOnce
						next.should.not.have.been.called
					})

		})

		it("should not call next() with an error, when original function runs fine", function(){
			var test_fn 	= sinon.stub(),
				wrapped_fn	= catchAsyncErrors(test_fn),
				next		= sinon.stub()

			return	wrapped_fn(null, null, next)
					.then( () => {
						test_fn.should.have.been.calledOnce
						next.should.not.have.been.called
					})

		})

	})


})