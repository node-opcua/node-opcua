"use strict";
/* global describe,it,before,after,beforeEach,afterEach*/
require("requirish")._(module);

var async = require("async");
var should = require("should");
var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var opcua = require("index");
var makeNodeId = opcua.makeNodeId;
var DataType = opcua.DataType;
var AttributeIds = opcua.AttributeIds;
var OPCUAClient = opcua.OPCUAClient;

var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;


module.exports = function (test) {

    describe("end-to-end testing registerNode", function () {

        var  client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        var namespaceIndex = 411;

        it("should register nodes - BadNothingToDo", function (done) {
            var browse_service = require("lib/services/browse_service");
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new browse_service.RegisterNodesRequest({
                    nodesToRegister: []
                });
                session.performMessageTransaction(request, function (err, response) {
                    err.message.should.match(/BadNothingToDo/);
                    inner_done();
                });

            }, done);
        });

        it("should register nodes - Good", function (done) {
            var browse_service = require("lib/services/browse_service");
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new browse_service.RegisterNodesRequest({
                    nodesToRegister: [
                        "ns=0;i=1"
                    ]
                });
                session.performMessageTransaction(request, function (err, response) {
                    should(err).eql(null);
                    response.registeredNodeIds.length.should.eql(1);
                    inner_done();
                });

            }, done);
        });

        it("should unregister nodes - BadNothingToDo", function (done) {
            var browse_service = require("lib/services/browse_service");
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new browse_service.UnregisterNodesRequest({
                    nodesToUnregister: []
                });
                session.performMessageTransaction(request, function (err, response) {
                    err.message.should.match(/BadNothingToDo/);
                    inner_done();
                });

            }, done);
        });

        it("should unregister nodes - Good", function (done) {
            var browse_service = require("lib/services/browse_service");
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new browse_service.UnregisterNodesRequest({
                    nodesToUnregister: [
                        "ns=0;i=1"
                    ]
                });
                session.performMessageTransaction(request, function (err, response) {
                    should(err).eql(null);
                    inner_done();
                });

            }, done);
        });
    });
};
