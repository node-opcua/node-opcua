"use strict";
/* global require,describe,it,beforeEach,afterEach*/
var should = require("should");


var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;
var UnregisterNodesRequest = opcua.register_node_service.UnregisterNodesRequest;
var RegisterNodesRequest = opcua.register_node_service.RegisterNodesRequest;
//xx var UnregisterNodesResponse = opcua.register_node_service.UnregisterNodesResponse;
//xx var RegisterNodesResponse = opcua.register_node_service.RegisterResponse;

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


        it("should register nodes - BadNothingToDo", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new RegisterNodesRequest({
                    nodesToRegister: []
                });
                session.performMessageTransaction(request, function (err/*, response*/) {
                    err.message.should.match(/BadNothingToDo/);
                    inner_done();
                });

            }, done);
        });

        it("should register nodes - Good", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new RegisterNodesRequest({
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
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new UnregisterNodesRequest({
                    nodesToUnregister: []
                });
                session.performMessageTransaction(request, function (err, response) {
                    should.exist(response);
                    err.message.should.match(/BadNothingToDo/);
                    inner_done();
                });

            }, done);
        });

        it("should unregister nodes - Good", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new UnregisterNodesRequest({
                    nodesToUnregister: [
                        "ns=0;i=1"
                    ]
                });
                session.performMessageTransaction(request, function (err, response) {
                    should.exist(response);
                    should(err).eql(null);
                    inner_done();
                });

            }, done);
        });
    });
};
