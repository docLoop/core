'use strict'


const	Promise	= require('bluebird')

module.exports = {


	serialize: function(obj, method_names){


		var original_methods 	= {},
			chain				= Promise.resolve()



		function chainRun(method_name, ...args){
			console.log('chaining ', method_name)
			if(!chain.isPending()) chain = Promise.resolve()

			return chain = 	chain
							.catch( e 	=> 	console.log(e) ) /*TODO*/
							.then( original_methods[method_name].bind(obj, ...args) )
		}

		function restore(){
			method_names.forEach( method_name => {
				obj[method_name] = original_fn
			})
		}



		method_names.forEach( method_name => {
			if(typeof obj[method_name] != 'function') throw new TypeError("Not a method '"+method_name+ "' on "+obj.toString())
			original_methods[method_name]	= obj[method_name]				
			obj[method_name] 				= chainRun.bind(this, method_name)
			obj[method_name].restore 		= restore
		})

	},


	collate: function(obj, method_name, timeout){

		if(typeof obj[method_name] != 'function') throw new TypeError("Not a method '"+method_name+ "' on "+obj.toString())

		timeout = timeout || 1000

		var original_fn		= obj[method_name],
			
			scheduled_runs 	= {},
			last_requests	= {} 

		function cleanUp(str){
			if( !scheduled_runs[str].isPending() ){
				delete scheduled_runs[str]
				delete last_requests[str] //TODO: test if deleted!
			}
		}

		function requestRun(...args){
			var now 	= 	Date.now(),
				str		=  	JSON.stringify(args)

			scheduled_runs[str] 	= scheduled_runs[str] 	|| Promise.resolve()
			last_requests[str]		= last_requests[str] 	|| 0


			if( scheduled_runs[str].isPending() ){
				console.log('pending', method_name)
				return 	now - last_requests[str] <  timeout
						?	scheduled_runs[str]
						:	scheduled_runs[str]
							.then( () => requestRun(...args) )	
			
			}

			last_requests[str] 	= 	now
			scheduled_runs[str] = 	Promise.resolve()
									.then( () => original_fn.apply(obj, args) )
									.finally( () => cleanUp(str) )

			return scheduled_runs[str]
		}

		function restore(){
			obj[method_name] = original_fn
			delete obj[method_name].restore
		}

		obj[method_name] 			= requestRun
		obj[method_name].restore 	= restore
	},




	cache: function(obj, method_name, timeout){
		if(typeof obj[method_name] != 'function') throw new TypeError("Not a method '"+method_name+ "' on "+obj.toString())

		timeout = timeout || 1000

		var original_fn		= obj[method_name],
			
			scheduled_runs 	= {},
			last_requests	= {} 

		function cleanUp(str){
			if( !scheduled_runs[str].isPending() ){
				delete scheduled_runs[str]
				delete last_requests[str] //TODO: test if deleted!
			}
		}

		function requestRun(...args){
			var now 	= 	Date.now(),
				str		=  	JSON.stringify(args)

			scheduled_runs[str] 	= scheduled_runs[str] 	|| Promise.resolve()
			last_requests[str]		= last_requests[str] 	|| 0


			
			if(now - last_requests[str] <  timeout) return scheduled_runs[str]

			last_requests[str] 	= 	now
			scheduled_runs[str] = 	Promise.resolve( original_fn.apply(obj, args) )

			return scheduled_runs[str]
		}

		function restore(){
			obj[method_name] = original_fn
			delete obj[method_name].restore
		}

		obj[method_name] 			= requestRun
		obj[method_name].restore 	= restore
	}

}