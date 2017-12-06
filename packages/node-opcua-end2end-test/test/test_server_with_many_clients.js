"use strict";

var should = require("should");
var assert = require("node-opcua-assert");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");

var ClientSession = opcua.ClientSession;

var ClientSubscription = opcua.ClientSubscription;

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var makeNodeId = opcua.makeNodeId;
var VariableIds = opcua.VariableIds;

//xx opcua.utils.setDebugFlag(__filename,true);
var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var port = 2000;
var maxConnectionsPerEndpoint = 100;
var maxAllowedSessionNumber   =  50;

var build_server_with_temperature_device = require("../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Functional test : one server with many concurrent clients", function () {

    var server, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(20000,this._timeout));

    var serverCertificateChain = null;
    before(function (done) {

        server = build_server_with_temperature_device({
            port: port,
            maxAllowedSessionNumber:  maxAllowedSessionNumber,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,

        }, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            serverCertificateChain = server.getCertificateChain();
            done(err);
        });
    });

    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
        done();
    });

    after(function (done) {
        server.shutdown(function () {
            done();
        });
    });

    var expectedSubscriptionCount = 0;

    function wait_randomly(callback) {
       setTimeout(callback, Math.ceil(100+Math.random() * 1500));
    }

    function construct_client_scenario(data) {

        var client = new OPCUAClient({
            serverCertificate: serverCertificateChain,
            requestedSessionTimeout: 120 * 1000
        });

        data.client = client;
        data.nb_received_changed_event = 0;

        var name = data.name;

        debugLog(" configuring ", data.name);

        var tasks = [

            wait_randomly,

            // connect the client
            function (callback) {
                client.connect(endpointUrl, function (err) {
                    debugLog(" Connecting client ", name);
                    callback(err);
                });
            },
            wait_randomly,

            // create the session
            function (callback) {
                client.createSession(function (err, session) {
                    debugLog(" session created for ", name);
                    data.session = session;
                    debugLog(" Error =".yellow.bold, err);
                    callback(err);
                });
            },

            // wait randomly up to 100 ms
            wait_randomly,

            // create a monitor item
            function (callback) {

                debugLog(" Creating monitored Item for client", name);
                var session = data.session;
                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 200,
                    requestedLifetimeCount:      10 * 60 * 10,
                    requestedMaxKeepAliveCount:  10,
                    maxNotificationsPerPublish:  200,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.on("started", function () {
                    debugLog("subscription started".yellow.bold, name.cyan, expectedSubscriptionCount, server.currentSubscriptionCount);
                });

                subscription.on("terminated", function () {
                    debugLog("subscription terminated".red.bold, name);
                });

                var monitoredItem = subscription.monitor(
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                        attributeId: AttributeIds.Value
                    },
                    {samplingInterval: 50, discardOldest: true, queueSize: 1});


                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    //xx console.log("monitoredItem.monitoringParameters.samplingInterval",monitoredItem.monitoringParameters.samplingInterval);//);
                });

                var counter = 0;
                monitoredItem.on("changed", function (dataValue) {
                    debugLog(" client ", name, " received value change ", dataValue.value.value);
                    data.nb_received_changed_event += 1;
                    counter ++;
                    if(counter === 2) {
                        callback();
                    }
                });
            },

            // let the client work for a little while
            wait_randomly,

            // closing  session
            function (callback) {
                data.session.close(function (err) {
                    debugLog(" closing session for  ", name);
                    callback(err);
                });
            },

            wait_randomly,

            // disconnect the client
            function (callback) {
                client.disconnect(function (err) {
                    debugLog(" client ", name, " disconnected");
                    callback(err);
                });
            }
        ];
        return tasks;
    }


    it("it should allow " + maxAllowedSessionNumber + " clients to connect and concurrently monitor some nodeId", function (done) {


        var nb_clients = server.maxAllowedSessionNumber;


        var clients = [];

        for (var i = 0; i < nb_clients; i++) {
            var data = {};
            data.name = "client " + i;
            data.tasks = construct_client_scenario(data);
            clients.push(data);
        }

        async.map(clients, function (data, callback) {

            async.series(data.tasks, function (err) {
                callback(err, data.nb_received_changed_event);
            });

        }, function (err, results) {

            results.forEach(function (nb_received_changed_event, index, array) {
                nb_received_changed_event.should.be.greaterThan(1,
                    'client ' + index + ' has received ' + nb_received_changed_event + ' events ( expecting at least 2)');
            });

            // also check that server has properly closed all subscriptions
            server.currentSubscriptionCount.should.eql(0);
            done(err);
        });
    });

});

