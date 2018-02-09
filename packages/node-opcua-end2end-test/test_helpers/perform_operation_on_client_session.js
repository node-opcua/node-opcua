"use strict";

var async = require("async");
var should = require("should");
var _ = require("underscore");

var opcua = require("node-opcua");
var ClientSubscription = opcua.ClientSubscription;
var resolveNodeId = opcua.resolveNodeId;
var AttributeIds = opcua.AttributeIds;
/**
 * @method perform_operation_on_client_session
 *
 * simple wrapper that operates on a freshly created opcua session.
 * The wrapper:
 *   - connects to the server,
 *   - creates a session
 *   - calls your **callback** method (func) with the session object
 *   - closes the session
 *   - disconnects the client
 *   - finally call the final **callback** (done_func)
 * @param client
 * @param endpointUrl  {String}
 * @param {Function} func
 * @param func.session  {Session} the done callback to call when operation is completed
 * @param func.done  {Function} the done callback to call when operation is completed
 * @param [func.done.err]  {Error} an optional error to pass if the function has failed
 * @param {Function} done_func
 * @param [done_func.err]  {Error} an optional error to pass if the function has failed
 */
function perform_operation_on_client_session(client, endpointUrl, func, done_func) {
    return client.withSession(endpointUrl,func,done_func);
}
exports.perform_operation_on_client_session = perform_operation_on_client_session;


/**
 * @method perform_operation_on_subscription
 *
 *  simple wrapper that operates on a freshly created subscription.
 *
 *  - connects to the server,and create a session
 *  - create a new subscription with a publish interval of 100 ms
 *  - calls your **callback** method (do_func) with the subscription object
 *  - delete the subscription
 *  - close the session and disconnect from the server
 *  - finally call the final **callback** (done_func)
 *
 * @param client {OPCUAClientBase}
 * @param endpointUrl {String}
 * @param {Function} do_func
 * @param do_func.session  {Session} the done callback to call when operation is completed
 * @param do_func.done  {Function} the done callback to call when operation is completed
 *
 * @param {Function} done_func
 * @param {Error} [done_func.err]
 */
// callback function(session, subscriptionId,done)
function perform_operation_on_subscription(client, endpointUrl, do_func, done_func) {

    perform_operation_on_client_session(client, endpointUrl, function (session, done) {

        var do_func_err =null;
        var subscription;
        async.series([

            function (callback) {
                subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 10 * 60,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    callback();
                });
            },

            function (callback) {
               try {
                   do_func(session, subscription, function(err) {
                       do_func_err = err;
                       callback(null);
                   });
               }
               catch(err) {
                   do_func_err = err;
                   callback(null);
               }
            },

            function (callback) {
                subscription.on("terminated", function() {
                    //
                });
                subscription.terminate(function(err) {
                    // ignore errors
                    if (err) { console.log(err.message);}
                    callback();
                });
            }
        ], function (err) {
            if (do_func_err) {
                err = do_func_err;
            }
            done(err);
        });

    }, done_func);
}

exports.perform_operation_on_subscription = perform_operation_on_subscription;


function perform_operation_on_raw_subscription(client,endpointUrl,f,done) {

    var result = {
        id: null
    };
    perform_operation_on_client_session(client, endpointUrl, function (session, inner_callback) {

        async.series([
            function(callback) {

                session.createSubscription({
                    requestedPublishingInterval: 100, // Duration
                    requestedLifetimeCount:      600,  // Counter
                    requestedMaxKeepAliveCount:  100, // Counter
                    maxNotificationsPerPublish:   10, // Counter
                    publishingEnabled:          true,   // Boolean
                    priority:                     14 // Byte
                }, function (err, response) {

                    if (!err) {
                        result.subscriptionId=response.subscriptionId;
                        f(session,result,function(err){
                            callback(err);
                        })
                    } else{
                        callback();
                    }
                });

            },
            function (callback) {
                session.deleteSubscriptions({
                    subscriptionIds: [result.subscriptionId]
                },callback);
            }
        ],inner_callback)
    },done);
}
exports.perform_operation_on_raw_subscription = perform_operation_on_raw_subscription;



function perform_operation_on_monitoredItem(client, endpointUrl, monitoredItemId, func, done_func) {

    var itemToMonitor;
    if (typeof monitoredItemId === "string") {
        itemToMonitor ={
            nodeId: resolveNodeId(monitoredItemId),
            attributeId: AttributeIds.Value
        };
    } else {
        itemToMonitor = monitoredItemId;
    }
    perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

        var monitoredItem;
        async.series([
            function (callback) {

                monitoredItem = subscription.monitor(itemToMonitor, {
                    samplingInterval: 1000,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("initialized", function () {
                    callback();
                });
            },
            function (callback) {
                func(session, subscription, monitoredItem, callback);
            },
            function (callback) {
                monitoredItem.terminate(function () {
                    callback();
                });
            }
        ], inner_done);

    }, done_func);
}
exports.perform_operation_on_monitoredItem = perform_operation_on_monitoredItem;
