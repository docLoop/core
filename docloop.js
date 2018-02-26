'use_strict'

var DocloopCore 			= 	require('./docloop-core.js'),
	DocloopAdapter			=	require('./docloop-adapter.js'),
	DocloopEndpoint			=	require('./docloop-endpoint.js'),
	DocloopLink				=	require('./docloop-link.js'),
	docloopErrorHandling	=	require('./docloop-error-handling.js'),
	EventQueue				=	require('./event-queue.js'),
	manageCalls				=	require('./manage-calls.js')


/**
 * TODO: Description for tis module
 * @module docloop
 * 
 * @alias docloop
 * 
 * @license GPL-3.0
 */

module.exports = {
	DocloopCore,
	DocloopAdapter,
	DocloopEndpoint,
	DocloopLink,
	EventQueue,
	...docloopErrorHandling,
	...manageCalls,

}