var OPCUAClient = require("../lib/client/opcua_client").OPCUAClient;
var OPCUASession = require("../lib/client/opcua_client").OPCUASession;
var ClientSubscription = require("../lib/client/client_subscription").ClientSubscription;
var assert = require('better-assert');
var async = require("async");
var should = require('should');
var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var ReadValueId = require("../lib/services/read_service").ReadValueId;
var AttributeIds = require("../lib/services/read_service").AttributeIds;
var resolveNodeId = require("../lib/datamodel/nodeid").resolveNodeId;
var sinon = require("sinon");


/**
 * simple wrapper that operates on a freshly created opcua session.
 * The wrapper:
 *   - connects to the server,
 *   - creates a session
 *   - calls your **callback** method (func) with the session object
 *   - closes the session
 *   - disconnects the client
 *   - finally call the final **callback** (done_func)
 *
 * @param {function:callback} func
 * @param {function:callback} done_func
 */
function perform_operation_on_client_session(client,func,done_func) {

    assert(_.isFunction(func));
    assert(_.isFunction(done_func));
    var the_session;

    async.series([

        // connect
        function(callback) { client.connect(endpointUrl,callback); },

        // create session
        function(callback) {
            client.createSession(function (err,session){
                if (!err) {
                    the_session = session;
                }
                callback(err);
            });
        },

        // call the user provided func
        function(callback) { func(the_session,callback); },

        // closing session
        function(callback) { the_session.close(function(err){ callback(err); }); },

        // disconnect
        function(callback) { client.disconnect(function() { callback(); }); }
    ],done_func);
}


/**
 *  simple wrapper that operates on a freshly created subscription.
 *
 *  - connects to the server,and create a session
 *  - create a new subscription with a publish interval of 100 ms
 *  - calls your **callback** method (do_func) with the subscription object
 *  - delete the subscription
 *  - close the session and disconnect from the server
 *  - finally call the final **callback** (done_func)
 *
 * @param client
 * @param do_func
 * @param done_func
 */
// callback function(session, subscriptionId,done)
function perform_operation_on_subscription(client,do_func,done_func){

    perform_operation_on_client_session(client,function(session,done){

        var subscription;
        async.series([

            function(callback) {
                subscription = new ClientSubscription(session,{
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount:      10 * 60 ,
                    requestedMaxKeepAliveCount:  5,
                    maxNotificationsPerPublish:  2,
                    publishingEnabled:           true,
                    priority:                    6
                });
                subscription.on("started",function(){ callback();  });
            },

            function(callback) {
                do_func(session,subscription,callback);
            },

            function(callback) {
                subscription.on("terminated",callback);
                subscription.terminate();
            }
        ], function(err) {
            done(err) ;
        });

    },done_func)
}


describe("testing Client-Server subscription use case, on a fake server exposing the temperature device",function() {


    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2001;
    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port+=1;
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });

    it("should create a ClientSubscription to manage a subscription",function(done){

        perform_operation_on_client_session(client,function(session,done){

            assert(session instanceof OPCUASession);

            var subscription = new ClientSubscription(session,{
                requestedPublishingInterval: 100,
                requestedLifetimeCount:      100 * 60 * 10 ,
                requestedMaxKeepAliveCount:  5,
                maxNotificationsPerPublish:  5,
                publishingEnabled:           true,
                priority:                    6
            });
            subscription.on("started",function(){
                setTimeout(function() { subscription.terminate(); },200 );
            });
            subscription.on("terminated",function(){
                done();
            });
        },done);
    });
    it("a ClientSubscription should receive keep-alive events from the server",function(done){

        perform_operation_on_client_session(client,function(session,done){

            assert(session instanceof OPCUASession);

            var nb_keep_alive_received = 0;

            var subscription = new ClientSubscription(session,{
                requestedPublishingInterval: 10,
                requestedLifetimeCount:      10 ,
                requestedMaxKeepAliveCount:  2,
                maxNotificationsPerPublish:  2,
                publishingEnabled:           true,
                priority:                    6
            });
            subscription.on("started",function(){
                setTimeout(function() { subscription.terminate(); }, 500 );
            });
            subscription.on("keepalive",function(){
                nb_keep_alive_received +=1;
            });
            subscription.on("terminated",function(){
                done();
                nb_keep_alive_received.should.be.greaterThan(0);
            });
        },done);
    });

    it("a ClientSubscription should survive longer than the life time",function(done){
        // todo
        done();
    });
    it("client should be able to create subscription to monitor the temperature variable and received notification of change",function(done){
        // todo
        done();
    });

    it("should be possible to monitor an item with a ClientSubscription",function(done){

        perform_operation_on_client_session(client,function(session,done){

            assert(session instanceof OPCUASession);

            var subscription = new ClientSubscription(session,{
                requestedPublishingInterval: 150,
                requestedLifetimeCount:      10 * 60 * 10 ,
                requestedMaxKeepAliveCount:  2,
                maxNotificationsPerPublish:  2,
                publishingEnabled:           true,
                priority:                    6
            });


            subscription.on("started",function(){

            });
            subscription.on("terminated",function(){
                done();
            });

            var monitoredItem  = subscription.monitor(
                {nodeId: resolveNodeId("ns=0;i=2258") , attributeId: AttributeIds.Value},
                {samplingInterval: 10,discardOldest: true,queueSize:1 });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized",function(){
                monitoredItem.terminate(function(){
                    subscription.terminate();
                });
            });

        },done);
    });
});

describe("testing server and subscription",function(){
    var server , client,temperatureVariableId,endpointUrl ;
    var port = 2001;
    before(function(done){
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });

    it(" a server should accept several Publish Requests from the client without sending notification immediately,"+
       " and should still be able to reply to other requests",function(done) {

        var subscriptionId;
        perform_operation_on_client_session(client,function(session,done){

            async.series([

                function(callback) {
                    session.createSubscription({
                        requestedPublishingInterval: 100,  // Duration
                        requestedLifetimeCount: 10,         // Counter
                        requestedMaxKeepAliveCount: 10,     // Counter
                        maxNotificationsPerPublish: 10,     // Counter
                        publishingEnabled: true,            // Boolean
                        priority: 14                        // Byte
                    }, function(err,response){
                        subscriptionId = response.subscriptionId;
                        callback(err);
                    });
                },
                function(callback) {
                    session.readVariableValue("RootFolder",function(err,dataValues,diagnosticInfos){
                        callback(err);
                    });
                },
                function(callback) {

                    // send many publish requests, in one go
                    session.publish({},function(err,response){});
                    session.publish({},function(err,response){});
                    session.publish({},function(err,response){});
                    session.publish({},function(err,response){});
                    session.publish({},function(err,response){});
                    session.publish({},function(err,response){});
                    callback();
                },
                function(callback) {
                   session.readVariableValue("RootFolder",function(err,dataValues,diagnosticInfos){
                        callback();
                   });
                },
                function(callback) {
                    session.deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    },function(err,response){
                        callback();
                    });
                }
            ], function(err) {
                done(err) ;
            });

        },done);
    });

    it("A Subscription can be added and then deleted",function(done){
        var subscriptionId;
        perform_operation_on_client_session(client,function(session,done){

            async.series([

                function(callback) {
                    session.createSubscription({
                        requestedPublishingInterval: 100,  // Duration
                        requestedLifetimeCount: 10,         // Counter
                        requestedMaxKeepAliveCount: 10,     // Counter
                        maxNotificationsPerPublish: 10,     // Counter
                        publishingEnabled: true,            // Boolean
                        priority: 14                        // Byte
                    }, function(err,response){
                        subscriptionId = response.subscriptionId;
                        callback(err);
                    });
                },


                function(callback) {
                    session.deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    },function(err,response){
                        callback();
                    });
                }
            ], function(err) {
                done(err) ;
            });

        },done)

    });

    it("A MonitoredItem can be added to a subscription and then deleted",function(done){

        perform_operation_on_subscription(client,function(session,subscription,callback){

            var monitoredItem  = subscription.monitor(
                {nodeId: resolveNodeId("ns=0;i=2258") , attributeId: AttributeIds.Value},
                {samplingInterval: 10,discardOldest: true,queueSize:1 });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized",function(){
                monitoredItem.terminate(function(){
                    callback();
                });
            });
        },done);

    });

    it("A MonitoredItem should received changed event",function(done){

        perform_operation_on_subscription(client,function(session,subscription,callback){

            var monitoredItem  = subscription.monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                },
                {samplingInterval: 100,discardOldest: true,queueSize:1 });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized",function(){
            });

            monitoredItem.on("changed",function(value){
                monitoredItem.terminate(function(){});
            });
            monitoredItem.on("terminated",function(value){
                callback();
            });

        },done);

    });

});
