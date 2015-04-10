/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("./helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var address_space_for_conformance_testing  = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var _port = 2000;


describe("Testing client with many monitored items",function() {

    this.timeout(20000);

    var server, client, temperatureVariableId, endpointUrl;

    var port = _port + 1;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({port: port}, function () {

            build_address_space_for_conformance_testing(server.engine,{ mass_variables: true});

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("should monitor a large number of node (see #69)", function (done) {


        var changeByNodes= {};
        function make_callback(_nodeId) {

            var nodeId = _nodeId;
            return  function(dataValue) {
                //Xx console.log(nodeId.toString() , "\t value : ",dataValue.value.value.toString());
                var idx = nodeId.toString();
                changeByNodes[idx] = changeByNodes[idx] ? changeByNodes[idx] + 1 : 1;
           };
        }
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            assert(session instanceof ClientSession);

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription.on("terminated", function () {
                inner_done();
            });

            var monitoredItems = [];

            var ids = [
                "Scalar_Simulation_Double",
                "Scalar_Simulation_Boolean" ,
                "Scalar_Simulation_String",
                "Scalar_Simulation_Int64",
                "Scalar_Simulation_LocalizedText"
            ];
            ids.forEach(function(id){
                var nodeId = "ns=411;s="+id;
                var monitoredItem = subscription.monitor(
                    {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                    {samplingInterval: 10, discardOldest: true, queueSize: 1});
                monitoredItem.on("changed",make_callback(nodeId));
            });


            setInterval(function() {
                subscription.terminate();
                Object.keys(changeByNodes).length.should.eql(ids.length);
            },2000);


        }, done);
    });

});
