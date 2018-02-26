'use strict'

var		EventEmitter 	= 	require('events'),
		Promise			= 	require('bluebird'),
		DocloopError	=	require('./docloop-error-handling.js').DocloopError

/**
 * Class representing a queued event.
 * Instances of this class will be created by an {@link module:docloop.EventQueue EventQueue}.
 *
 * @memberof	module:docloop.EventQueue
 * 
 * @inner
 * 
 * @param		{module:docloop.EventQueue}	 queue					The event queue this event is queued in.
 * @param 		{Object} 					 data 					
 * @param		{Object}					[data.event={}]			Sets data property.
 * @param		{String}					 data.eventName			Sets eventName property.
 * @param 		{lastAttempt} 				[data.lastAttempt=0]	Sets lastAttempt property.
 * @param		{attempts}					[data.attempts=0]		Sets attempts property.
 *
 * @property	{Object}					 event					Data of the original event.
 * @property	{String}					 eventName				Name of the original event.
 * @property 	{lastAttempt} 				 lastAttempt			Timestamp of the last attempt to process this event.
 * @property	{attempts}					 attempts				Number of attempts.	
 */
class QueuedEvent {

	constructor(queue, data){

		if(!(queue instanceof EventQueue))	throw new TypeError('QueuedEvent.constructor(): queue must be and EventQueue. '+queue)

		this.queue 			= queue
		this.event 			= data.event || {}
		this.eventName		= data.eventName
		this.lastAttempt	= data.lastAttempt 	|| 0
		this.attempts		= data.attempts 	|| 0
	}

	/**
	 * Stores the queued event to the database.
	 *
	 * @async
	 * 
	 * @return {Object|Boolean} 	Result of db.collection.findOneAndReplace()
	 */
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

	/**
	 * Updates the event in the database, increasing the number of attempts by one and setting lastAttempt to now.
	 *
	 * @async
	 * 
	 * @return {} undefined
	 */
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
	}

	/**
	 * Removes the queued event form the database.
	 *
	 * @async
	 * 
	 * @return {Object} 	Result of db.collection.remove()
	 */
	remove(){
		return 	this.queue.collection.remove({ 
						event: 			this.event, 
						eventName: 		this.eventName 
				})
	}


	/**
	 * Emits an {@link module:docloop.EventQueue.event:-attempt -attempt event} and increases the number of attempts.
	 *
	 * @async
	 * 
	 * @return {} undefined
	 */
	attempt(){
		return	Promise.resolve()
				.then( ()	=>	this.update() )
				.then( ()	=> 	this.queue.emit(this.eventName+'-attempt', this) )
				.then( ()	=>	undefined)
	}

	/**
	 * Emits an {@link module:docloop.EventQueue.event:-fail -fail event} and removes the queued event from the queue.
	 * 
	 * @async
	 * 
	 * @param  {Error|String} reason	Error or Reason that let to the abandonment.
	 * 
	 * @return {}        				undefined
	 */
	abandon(reason){
		this.reason = reason
		return 	Promise.resolve()
				.then( () 	=> this.remove() )		
				.then( () 	=> this.queue.emit(this.eventName+'-fail', this) )
				.then( ()	=>	undefined)
	}

	/**
	 * Emits an {@link module:docloop.EventQueue.event:-done -done event} and removes the queued event from the queue.
	 * 
	 * @async
	 * 
	 * @return {} undefined
	 */
	checkOff(){
		return	Promise.resolve()
				.then( () 	=> this.remove() )	
				.then( () 	=> this.queue.emit(this.eventName+'-done', this) )
				.then( ()	=>	undefined)
	}

}



/**
 * An {@link module:docloop.EventQueue EventQueue} emits this event periodically for every due event.
 * 
 * The event name will be prefixed with the wrapped event's name (e.g. 'my-event-attempt').
 *
 * @memberOf	module:docloop.EventQueue
 * 
 * @event		-attempt
 *
 * @type		{module:docloop.EventQueue~QueuedEvent}
 */

/**
 * An {@link module:docloop.EventQueue EventQueue} emits this event when the wrapped event had not been checked off after all retries where spent.
 * 
 * The event name will be prefixed with the wrapped event's name (e.g. 'my-event-fail').
 *
 * @memberOf	module:docloop.EventQueue
 * 
 * @event		-fail
 *
 * @type		{module:docloop.EventQueue~QueuedEvent}
 * 
 */

/**
 * An {@link module:docloop.EventQueue EventQueue} emits this event when the wrapped event is checked off.
 * 
 * The event name will be prefixed with the wrapped event's name (e.g. 'my-event-done').
 *
 * @memberOf	module:docloop.EventQueue
 * 
 * @event		-done
 *
 * @type		{module:docloop.EventQueue~QueuedEvent}
 * 
 */


/**
 * Class representing a queue of events to be checked off or repeated if need be.
 *
 * Every event added to the qeue will be wrapped into a {@link module:docloop.EventQueue~QueuedEvent QueuedEvent}. 
 * And that in turn will be emitted periodically as {@link module:docloop.EventQueue.event:-attempt -attempt event}
 * until it exceeds the maximal number of retries, is {@link module:docloop.EventQueue~QueuedEvent.abandon abandoned} for some other reason or is {@link module:docloop.EventQueue~QueuedEvent.checkOff checked off}. 
 *
 * @alias		EventQueue
 * 
 * @memberof 	module:docloop
 * 
 * @param 		{Object} 					 config 
 * @param		{Collection}				 config.collection 			MongoDb collection. Sets collection property.
 * @param 		{Number|Number[]|Function} 	[config.delay] 				Sets delay property.
 * @param 		{Number} 					[config.maxRetries=3]		Sets maxRetries property.
 * @param 		{Number} 					[config.processInterval]	Milliseconds. Time until the qeue checks again for due events.
 * @param 		{Number} 					[config.spread=1000]		Sets spread property.
 *
 * @property 	{Collection} 				 collection					This is where the queue stores active events.
 * @property 	{Number|Number[]|Function} 	[delay] 					Delay until the event will fire again if not checked off. If an array is provided the nth retry will be delayed for this.delay[n-1] milliseconds. If a function is provided the nth attempt will be delayed for this.delay(n) milliseconds. Defaults to: (attempts  => Math.pow(10, attempts)*1000)
 * @property 	{Number} 					[maxRetries=3] 				Number of retries until the event will be marked as failed. if this.delay is an array, this value defaults to this.delay.length.
 * @property 	{Number} 					[spread=1000]				Milliseconds. If multiple events are due to retrial, they wont fire all at once but will be spread with a fixed delay between each of them.
 * @property	{Number}					 processInterval			Milliseconds. Time until the queue checks again for due events.
 * @property	{Timeout}					 timeout					The Timeout object returned by setInterval for the periodical check.
 *
 */
class EventQueue extends EventEmitter{

	constructor(config){
		if(!config)				throw new ReferenceError("missing config")
		if(!config.collection) 	throw new ReferenceError("missing collection")

		super()

		var defaults = {
			collection:			undefined,
			delay:				(attempts  => Math.pow(10, attempts)*1000),
			maxRetries:			config.delay.length  || 3,
			processInterval:	10*60*1000,
			spread:				1000
		}

		for(var key in defaults){
			this[key]			= config[key] != undefined ? config[key] : defaults[key]
		}

		this.timeout			= undefined

	}


	/**
	 * Starts looking periodically for due or failed events.
	 * 
	 * @return {this} 
	 */
	start(){
		clearInterval(this.timeout)
		this.timeout = setInterval(this.process.bind(this), this.processInterval)
		return this
	}

	/**
	 * Stops looking periodically for due or failed events.
	 * 
	 * @return {this}
	 */
	stop(){
		clearInterval(this.timeout)
		return this
	}

	/**
	 * Removes all events from the queue without further notice.
	 * 
	 * @async
	 * 
	 */
	clear(){
		return this.collection.remove({})
	}

	/**
	 * Adds an event to the queue. For every added event the queue will immediately emit an {@link module:docloop.EventQueue.event:attempt}.
	 *
	 * @async 
	 * 
	 * @param {String}  event_name 		An event name
	 * @param {Object} [event={}]      	Data associated with the event
	 *
	 * @returns {module:docloop.EventQueue~QueuedEvent}
	 */
	add(event_name, event = {}){
		
		var queued_event = new QueuedEvent(this, {eventName:event_name, event:event} )

		return	Promise.resolve()
				.then( ()	=> 	queued_event.store() )
				.then( ()	=>	queued_event.attempt() )
				.then( ()	=>	queued_event)

	}


	/**
	 * Returns the delay for the nth retry. The 0th retry is considered the first attempt and has no delay.
	 * 
	 * @param  {Number} attempts 	Number of previous attempts.
	 * @return {Number|undefined}   
	 */
	_getDelay(attempts){
		if(attempts == 0) return 0

		if(typeof this.delay == 'number') 	return  this.delay 			
		if(typeof this.delay == 'object') 	return  this.delay[attempts-1] 
		if(typeof this.delay == 'function')	return  this.delay(attempts) 

		return undefined
	}

	/**
	 * Checks if events are due for retries or have failed. 
	 * 
	 * Every event that has more attempts than .maxRetries will be abandoned.
	 * Every event that is due will be attempted.
	 *
	 * @async
	 * 
	 * @emits {@link module:docloop.EventQueue.event:-attempt -attempt}
	 * @emits {@link module:docloop.EventQueue.event:-fail -fail}
	 * 
	 */
	process(){
		var now = new Date().getTime()

		return	Promise.map(
					this.collection.find({}).toArray(),
					event_data	=>	new QueuedEvent(this, event_data)
				)
				.map( (queued_event, index) => {

					var delta 	= now - queued_event.lastAttempt,
						delay 	= this._getDelay(queued_event.attempts),
						due		= delta >= (delay||0),
						failed	= queued_event.attempts > this.maxRetries	

					if(failed)	return 	Promise.delay(this.spread*index)
										.then( () => queued_event.abandon(new DocloopError("EventQueue.process() queued event exceeded maxRetries.")) )
										.then( () => false)

					if(due) 	return 	Promise.delay(this.spread*index)
										.then( () => queued_event.attempt() )
										.then( () => true)
				})
	}


}


module.exports = EventQueue