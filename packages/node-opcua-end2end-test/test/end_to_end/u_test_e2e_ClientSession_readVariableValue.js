"use strict";


var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {

    describe("ClientSession#readVariableValue", function () {

        var client, endpointUrl;


        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(function (err) {
                client = null;
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

                    //xx console.log("dataValue = ", results[1].toString());
                    inner_done();
                });
            }, done);

        });

    });
};
