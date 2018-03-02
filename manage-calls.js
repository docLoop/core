'use strict'


const	Promise	= require('bluebird')

module.exports = {

	/**
	 * Replaces a method of provided object with a proxy, that will chain consecutive calls: 
	 * So the orginal method will be called right after all previous calls have been resolved or rejected.
	 *
	 * The proxy method will allways wrap the original method in a Promise. 
	 * 
	 * You can provide an array of method names to serialize multiple methods at once.
	 *
	 * This may help to prevent timing conflicts of multiple calls.
	 *
	 * The orginial mthod can be restored with obj.[method_name].restore().
	 *
	 * @memberof	module:docloop
	 * 
	 * @param  		{Object} 				obj         	Target object
	 * @param  		{string | string[]} 	method_names	Name(s) of the method(s) whose calls should be serialized.
	 *
	 * @throws 		{TypeError} 							If one of the method names does not point to a function.
	 * 
	 * @return 		{}										undefined          
	 * 	 	 
	 */
	serializeCalls: function(obj, method_names){


		var original_methods 	= {},
			chain				= Promise.resolve()


		if(!method_names.forEach) method_names = [method_names]

		function chainRun(method_name, ...args){
			if(!chain.isPending()) chain = Promise.resolve()

			return chain = 	chain
							.catch( e 	=> 	console.log(e) ) /*TODO*/
							.then( original_methods[method_name].bind(obj, ...args) )
		}

		function restore(){
			method_names.forEach( method_name => {
				obj[method_name] = original_methods[method_name]
			})
		}



		method_names.forEach( method_name => {
			if(typeof obj[method_name] != 'function') throw new TypeError("Not a method '"+method_name+ "' on "+obj.toString())
			original_methods[method_name]	= obj[method_name]				
			obj[method_name] 				= chainRun.bind(this, method_name)
			obj[method_name].restore 		= restore
		})

	},


	/**
	 * Replaces a method of provided object with a proxy, 
	 * that will prevent multiple calls to the original method with the same arguments 
	 * while waiting for a response.
	 *
	 * The proxy method will allways wrap the original method in a Promise. 
	 * 
	 * If a previous call with the same arguments is still pending the proxy will return the corresponding promise.
	 * 
	 * This may help to prevent multiple redudant API calls. 
	 * (e.g. when you dont expect the result of an API call to change while it's pending)
	 *
	 * Two sets of arguments are considered equal if their JSON representaions are equal.
	 *
	 * The orginial method can be restored with obj[method_name].restore().
	 * 
	 * @memberof	module:docloop
	 * 
	 * @param  {Object}  obj					Target object
	 * @param  {string}  method_name			Name of the method whose calls should be callated
	 * @param  {Number}	[force_call_after=1000] After this time (in milliseconds) the proxy will call the original method, regardless of previous calls still pending.
	 *
	 * @throws {TypeError} 						If method_name does not point to a function.
	 * 
	 * @return {}								undefined				
	 */
	collateCalls: function(obj, method_name, force_call_after = 1000){

		if(typeof obj[method_name] != 'function') throw new TypeError("collateCalls(): Not a method '"+method_name+ "' on "+obj.toString())

		var original_fn		= obj[method_name],
			scheduled_runs 	= {}

		function requestRun(...args){
			var str		=  	JSON.stringify(args)


			if(!scheduled_runs[str] || !scheduled_runs[str].isPending()){
				scheduled_runs[str] = Promise.resolve( original_fn.apply(obj, args) )
				setTimeout( () => scheduled_runs[str] = undefined, force_call_after)
			}

			return scheduled_runs[str]
		}

		function restore(){
			obj[method_name] = original_fn
		}

		obj[method_name] 			= requestRun
		obj[method_name].restore 	= restore
	},




	/**
	 * Replaces a method of provided object with a proxy, 
	 * that will cache the return value of the original method for the givin period of time. 
	 * If the proxy is called the original method will be called only if there is no cached value.
	 *
	 * The proxy method will allways wrap the original method in a Promise. 
	 *  
	 * This may help to prevent redundant API calls (e.g. if you know that the result of an API call will not change in the next 10 seconds)
	 * 
	 * Two calls with different arguments will be cached separately.
	 * Two sets of arguments are considered equal if their JSON representaions are equal.
	 *
	 * The orginial method can be restored with obj[method_name].restore().
	 *
	 * @memberof	module:docloop
	 * 
	 * @param  {Object} obj         	Target object
	 * @param  {String} method_name 	Name of the method whose calls should be cached.
	 * @param  {Number} ttl=1000    	Time to live for the cache values in milliseconds.
	 * 
	 * @throws {TypeError} 				If method_name does not point to a function.
	 * 
	 * @return {}						undefined             	
	 */
	cacheCalls: function(obj, method_name, ttl = 1000){
		if(typeof obj[method_name] != 'function') throw new TypeError("cacheCalls(): Not a method '"+method_name+ "' on "+obj.toString())

		var original_fn			= obj[method_name],
			scheduled_runs 		= {}

		function requestRun(...args){

			var str	= JSON.stringify(args)
			
			if(!scheduled_runs[str]){
				scheduled_runs[str] = Promise.resolve( original_fn.apply(obj, args) )
				setTimeout( () => scheduled_runs[str] = undefined , ttl)
			}

			return scheduled_runs[str]
		}

		function restore(){
			obj[method_name] = original_fn
			delete obj[method_name].restore
		}

		obj[method_name] 			= requestRun
		obj[method_name].restore 	= restore
	},


	/**
	 * Todo
	 * 
	 */
	limitCalls: function(obj, method_name, ttl){
		if(typeof obj[method_name] != 'function') throw new TypeError("limitCalls(): Not a method '"+method_name+ "' on "+obj.toString())

		var original_fn	= obj[method_name],
			timeout		= undefined
	

		function requestRun(){

			if(timeout) clearTimeout(timeout)

			timeout = setTimeout( () => original_fn.apply(obj), ttl)

		}

		
		function restore(){
			obj[method_name] = original_fn
			delete obj[method_name].restore
		}

		obj[method_name] 			= requestRun
		obj[method_name].restore 	= restore
	}

}