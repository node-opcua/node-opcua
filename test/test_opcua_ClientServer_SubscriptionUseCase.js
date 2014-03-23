var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var OPCUASession = require("../lib/opcua-client").OPCUASession;
var ClientSubscription = require("../lib/client/client_subscription").ClientSubscription;
var assert = require('better-assert');
var async = require("async");
var should = require('should');
var build_server_with_temperature_device = require("./utils/build_server_with_temperature_device").build_server_with_temperature_device;
var sinon = require("sinon");

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

    /**
     * simple wrapper that operates on a freshly created opcua session.
     * The wrapper:
     *   - connects to the server,
     *   - creates a session
     *   -     calls your callback method wit the session object
     *   - closes the session
     *   - disconnects the client
     *
     * @param func
     * @param done_func
     */
    function perform_operation_on_client_session(func,done_func) {

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
            function(callback) { client.disconnect(function() {  callback(); }); }
        ],done_func);
    }

    it("should create a ClientSubscription to manage a subscription",function(done){

        perform_operation_on_client_session(function(session,done){

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
                setTimeout(function() { subscription.terminate(); },1000 );
            });
            subscription.on("terminated",function(){
                done();
            });
        },done);
    });
    it("a ClientSubscription should receive keep-alive events from the server",function(done){

        perform_operation_on_client_session(function(session,done){

            assert(session instanceof OPCUASession);

            var nb_keep_alive_received = 0;

            var subscription = new ClientSubscription(session,{
                requestedPublishingInterval: 10,
                requestedLifetimeCount:      10 * 60 * 10 ,
                requestedMaxKeepAliveCount:  2,
                maxNotificationsPerPublish:  2,
                publishingEnabled:           true,
                priority:                    6
            });
            subscription.on("started",function(){
                setTimeout(function() { subscription.terminate(); },1000 );
            });
            subscription.on("keepalive",function(){
                nb_keep_alive_received +=1;
            });
            subscription.on("terminated",function(){
                nb_keep_alive_received.should.be.greaterThan(0);
                done();
            });
        },done);
    });
    it("a ClientSubscription should survive longer than the life time",function(done){
        done();
    });
    it("client should be able to create subscription to monitor the temperature variable and received notification of change",function(done){
        done();
    });
});
