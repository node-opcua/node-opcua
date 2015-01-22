require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("../");

var ClientSession = opcua.ClientSession;
assert(_.isFunction(ClientSession));

var ClientSubscription = opcua.ClientSubscription;

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant =  opcua.Variant ;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var resolveNodeId = opcua.resolveNodeId;
var AttributeIds = opcua.AttributeIds;

var BrowseDirection = opcua.browse_service.BrowseDirection;

//xx opcua.utils.setDebugFlag(__filename,true);
var debugLog  = opcua.utils.make_debugLog(__filename);

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("Functional test : one server with many concurrent clients",function() {

    var server , temperatureVariableId, endpointUrl;

    this.timeout(10000);

    before(function (done) {

        server = build_server_with_temperature_device({
            port: port,
            maxAllowedSessionNumber: 10
        }, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {

        done();
    });

    afterEach(function (done) {

        done();
    });
    after(function(done) {
        server.shutdown(function() {
            done();
        });
    });

    var expectedSubscriptionCount = 0;

    function construct_client_scenario(data) {

        var client = new OPCUAClient();

        data.client = client;
        data.nb_received_changed_event = 0;

        var name = data.name;

        debugLog(" configuring ",data.name);


        var tasks = [

            // wait randomly up to 100 ms
            function(callback) {setTimeout(callback,Math.ceil(Math.random()*100)); },

            // connect the client
            function(callback) {
                client.connect(endpointUrl,function(err) {
                    debugLog(" Connecting client ", name);
                    callback(err);
                });
            },

            // wait randomly up to 100 ms
            function(callback) {setTimeout(callback,Math.ceil(Math.random()*100)); },

            // create the session
            function(callback) {
                client.createSession(function(err,session){
                    debugLog(" session created for " , name);
                    data.session = session;
                    debugLog(" Error =".yellow.bold,err);
                    callback(err);
                });

            },

            // wait randomly up to 100 ms
            function(callback) {setTimeout(callback,Math.ceil(Math.random()*100)); },

            // create a monitor item
            function(callback) {

                debugLog(" Creating monitored Item for client",name);
                var session = data.session;
                assert(session instanceof ClientSession);


                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });


                subscription.on("started", function () {
                    debugLog("subscription started".yellow.bold,name.cyan,expectedSubscriptionCount,server.currentSubscriptionCount);
                    callback();
                });

                subscription.on("terminated", function () {
                    console.log("subscription terminated".red.bold,name);
                });

                var monitoredItem = subscription.monitor(
                    {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                    {samplingInterval: 10, discardOldest: true, queueSize: 1 });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                });
                monitoredItem.on("changed", function (dataValue) {
                    debugLog(" client ", name," received value change ",dataValue.value.value);
                    data.nb_received_changed_event += 1;
                });
            },

            // let the client work for 800 ms
            function(callback) {   setTimeout(callback,800);  },


            // closing  session
            function (callback) {

                data.session.close(function (err) {
                    debugLog(" closing session for  ", name);
                    callback(err);
                });

            },

            // disconnect the client
            function(callback) {
                client.disconnect(function(err){
                    debugLog(" client ",name, " disconnected");
                    callback(err);
                });

            }
        ];
        return tasks;
    }


    it("it should allow 10 clients to connect and concurrently monitor some nodeId",function(done) {


        var nb_clients = server.maxAllowedSessionNumber;
        nb_clients.should.eql(100);


        var clients = [];

        for (var i =0 ; i<nb_clients; i++ ) {
            var data = {};
            data.name = "client " + i;
            data.tasks = construct_client_scenario(data);
            clients.push(data);
        }

        async.map(clients, function(data,callback){

            async.series(data.tasks,function(err) {
                callback(err,data.nb_received_changed_event);
            });

        }, function(err,results){

            results.forEach(function(nb_received_changed_event,index,array){
                nb_received_changed_event.should.be.greaterThan(1 ,
                        'client ' + index + ' has received ' + nb_received_changed_event + ' events ( expecting at least 2)' );
            });

            // also check that server has properly closed all subscriptions
            server.currentSubscriptionCount.should.eql(0);
            done(err);
        });
    });

});

