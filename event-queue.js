'use strict'

var		EventEmitter 	= 	require('events'),
		Promise			= 	require('bluebird')

class QueuedEvent {

	constructor(queue, data){

		if(!(queue instanceof EventQueue))	throw new TypeError('QueuedEvent.constructor(): queue must be and EventQueue. '+queue)
		if(!data.event)					 	throw new ReferenceError('QueuedEvent.constructor(): missing event.')


		this.queue 			= queue
		this.event 			= data.event
		this.eventName		= data.eventName
		this.lastAttempt	= data.lastAttempt 	|| 0
		this.attempts		= data.attempts 	|| 0
	}

	store(){
		return 	this.queue.collection.findOneAndReplace(
					{ 
						event: 			this.event, 
						eventName: 		this.eventName 
					}, 

					{
						event: 			this.event,
						eventName: 		this.eventName, 
						lastAttempt: 	this.lastAttempt,
						attempts:		this.attempts
					}, 
					{ upsert:true }
				)
	}

	update(){
		return	this.queue.collection.findOneAndUpdate(
					{ 
						event: 			this.event, 
						eventName: 		this.eventName 
					}, 
					{
						'$set':{ lastAttempt: 	Date.now() },
						'$inc':{ attempts:		1 }
					},
					{ returnNewDocument : true }
				)
				.then( result		=> result.value)
				.then( event_data	=> {
					this.lastAttempt 	= event_data.lastAttempt
					this.attempts		= event_data.attempts 
				})
				.catch(console.log)
	}


	remove(){
		return 	this.queue.collection.remove({ 
						event: 			this.event, 
						eventName: 		this.eventName 
				})
	}


	attempt(){
		return	Promise.resolve()
				.then( ()	=>	this.update() )
				.then( ()	=> 	this.queue.emit(this.eventName+'-attempt', this) )
	}

	abandon(reason){
		this.reason = reason
		return 	Promise.resolve()
				.then( () 	=> this.remove() )		
				.then( () 	=> this.queue.emit(this.eventName+'-fail', this) )
	}

	settle(){
		return	Promise.resolve()
				.then( () 	=> this.remove() )	
				.then( () 	=> this.queue.emit(this.eventName+'-done', this) )
	}

}





class EventQueue extends EventEmitter{

	//Todo: maybe log stats

	constructor(config){
		if(!config)				throw new ReferenceError("missing config")
		if(!config.collection) 	throw new ReferenceError("missing collection")

		super()

		var defaults = {
			collection:			undefined,
			delay:				(attempts  => Math.pow(10, attempts)*1000),
			maxRetries:			config.delay.length  || 3,
			processInterval:	10*60*1000,
			spread:				100
		}

		for(var key in defaults){
			this[key]			= config[key] != undefined ? config[key] : defaults[key]
		}

		this.interval			= undefined

	}

	start(){
		clearInterval(this.interval)
		this.interval = setInterval(this.process.bind(this), this.processInterval)
	}

	stop(){
		clearInterval(this.interval)
	}

	clear(){
		return this.collection.remove({})
	}

	add(event_name, event){
		
		var queued_event = new QueuedEvent(this, {eventName:event_name, event:event} )

		return	Promise.resolve()
				.then( ()	=> 	queued_event.store() )
				.then( ()	=>	queued_event.attempt() )

	}

	// get(event){
	// 	return  this.collection.findOne({event})
	// 			.then( event_data => new QueuedEvent(this, event_data ))
	// }

	// attempt(event){
	// 	return	Promise.resolve()
	// 			.then( ()			=>	this.get(event)	)
	// 			.then( queued_event	=>	queued_event.attempt() )
	// }

	// abandon(event, reason){
	// 	return 	Promise.resolve()
	// 			.then( ()			=>	this.get(event)	)
	// 			.then( queued_event	=>	queued_event.abandon(reason) )
	// }

	// settle(event){
	// 	return	Promise.resolve()
	// 			.then( ()			=>	this.get(event)	)
	// 			.then( queued_event	=>	queued_event.settle() )
	// }

	_getDelay(attempts){
		if(attempts == 0) return 0

		if(typeof this.delay == 'number') 	return  this.delay 			
		if(typeof this.delay == 'object') 	return  this.delay[attempts-1] 
		if(typeof this.delay == 'function')	return  this.delay(attempts) 

		return undefined
	}

	process(){
		var now = new Date().getTime()

		return	Promise.map(
					this.collection.find({}).toArray(),
					event_data	=>	new QueuedEvent(this, event_data)
				)
				.map( (queued_event, index) => {

					var delta 	= now - queued_event.lastAttempt,
						delay 	= this._getDelay(queued_event.attempts),
						due		= delta >= delay,
						failed	= queued_event.attempts > this.maxRetries	

					if(failed)	return 	Promise.delay(this.spread*index)
										.then( () => queued_event.abandon() )
										.then( () => false)

					if(due) 	return 	Promise.delay(this.spread*index)
										.then( () => queued_event.attempt() )
										.then( () => true)
				})
	}


}


module.exports = EventQueue