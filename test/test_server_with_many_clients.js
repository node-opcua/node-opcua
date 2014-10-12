
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("../");

var OPCUASession = opcua.OPCUASession;
assert(_.isFunction(OPCUASession));

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
var debugLog  = opcua.utils.make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("Functional test : one server with 10 concurrent clients",function() {

    var server , temperatureVariableId, endpointUrl;

    this.timeout(10000);

    before(function (done) {

        server = build_server_with_temperature_device({ port: port}, function () {
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

    function construct_client_scenario(data) {

        var client = new OPCUAClient();

        data.client = client;
        data.nb_received_changed_event = 0;

        var name = data.name;

        debugLog(" configuring ",data.name);
        var tasks = [];

        tasks.push(function(callback) {setTimeout(callback,Math.ceil(Math.random()*1000)); });

        tasks.push(function(callback) {
            client.connect(endpointUrl,function(err) {
                debugLog(" Connecting client ", name);
                callback(err);
            });
        });

        tasks.push(function(callback) {setTimeout(callback,Math.ceil(Math.random()*100)); });

        tasks.push(function(callback) {
            client.createSession(function(err,session){
                debugLog(" session created for " , name);
                data.session = session;
                debugLog(" Error =".yellow.bold,err);
                callback(err);
            });

        });

        tasks.push(function(callback) {setTimeout(callback,Math.ceil(Math.random()*100)); });

        tasks.push(function(callback) {

            debugLog(" Creating monitored Item for client",name);
            var session = data.session;
            assert(session instanceof OPCUASession);


            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });


            subscription.on("started", function () {
                debugLog("subscription started",name);
                callback();
            });

            subscription.on("terminated", function () {
                debugLog("terminated started",name);
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
        });

        tasks.push(function(callback) {
            setTimeout(callback,800);
        });


        // closing  session
        tasks.push(function (callback) {

            data.session.close(function (err) {
                debugLog(" closing session for  ", name);
                callback(err);
            });

        });

        tasks.push(function(callback) {

            client.disconnect(function(err){
                debugLog(" client ",name, " disconnected");
                callback(err);
            });

        });

        return tasks;
    }


    it("it should allow many clients to connect and concurrently monitor some nodeId",function(done) {

        var nb_clients = 20;
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

            results.forEach(function(nb_received_changed_event){
                nb_received_changed_event.should.be.greaterThan(1);
            });

            done(err);
        });
    });





});

