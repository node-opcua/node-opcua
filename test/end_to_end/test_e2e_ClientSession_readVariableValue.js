"use strict";
require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var browse_service = opcua.browse_service;
var BrowseDirection = browse_service.BrowseDirection;


var debugLog = require("lib/misc/utils").make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


describe("ClientSession#readVariableValue", function () {

    var server, client, temperatureVariableId, endpointUrl;


    beforeEach(function (done) {

        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client.disconnect(function (err) {
            client = null;
            done(err);
        });
    });

    before(function (done) {
        resourceLeakDetector.start();
        server = build_server_with_temperature_device({port: port}, function (err) {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);

        });
    });

    after(function (done) {
        server.shutdown(function (err) {
            resourceLeakDetector.stop();
            done(err);
        });
    });

    it("ClientSession#readVariableValue - case 1 - a single nodeId", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.readVariableValue("ns=0;i=2258", function (err, dataValue) {

                dataValue.should.not.be.instanceOf(Array);
                //xx console.log(" dataValue = ",dataValue.toString());
                inner_done();
            });

        }, done);
    });

    it("ClientSession#readVariableValue - case 2 - an array of nodeIds", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.readVariableValue(["ns=0;i=2258", "ns=0;i=2257"], function (err, results) {

                results.should.be.instanceOf(Array);
                results.length.should.eql(2);
                //xx console.log(" dataValue = ",results[0].toString());
                //xx console.log(" dataValue = ",results[1].toString());
                inner_done();
            });

        }, done);
    });

    it("ClientSession#readVariableValue - case 3 - a single ReadValueId", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            var readValueId1 = {
                nodeId: "ns=0;i=2258",
                attributeId: opcua.AttributeIds.BrowseName
            };
            var readValueId2 = {
                nodeId: "ns=0;i=2258",
                attributeId: opcua.AttributeIds.NodeClass
            };

            session.readVariableValue([readValueId1, readValueId2], function (err, results) {

                results.should.be.instanceOf(Array);
                results.length.should.eql(2);

                results[0].value.value.name.should.eql("CurrentTime");
                results[1].value.value.should.eql(2);

                console.log(" dataValue = ", results[1].toString());
                inner_done();
            });
        }, done);

    });

});
