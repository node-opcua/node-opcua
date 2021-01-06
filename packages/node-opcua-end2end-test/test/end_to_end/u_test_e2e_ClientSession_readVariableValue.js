"use strict";


const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {

    describe("ClientSession#readVariableValue", function () {

        let client, endpointUrl;

        beforeEach(function (done) {
            client = OPCUAClient.create();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect((err) => {
                client = null;
                done(err);
            });
        });

        it("ClientSession#readVariableValue - case 1 - a single nodeId",  (done) => {

            perform_operation_on_client_session(client, endpointUrl,  (session, inner_done) => {

                session.readVariableValue("ns=0;i=2258",  (err, dataValue) => {

                    dataValue.should.not.be.instanceOf(Array);
                    //xx console.log(" dataValue = ",dataValue.toString());
                    inner_done();
                });

            }, done);
        });

        it("ClientSession#readVariableValue - case 2 - an array of nodeIds",  (done) => {

            perform_operation_on_client_session(client, endpointUrl, (session, inner_done) => {

                session.readVariableValue(["ns=0;i=2258", "ns=0;i=2257"], (err, results) => {

                    results.should.be.instanceOf(Array);
                    results.length.should.eql(2);
                    //xx console.log(" dataValue = ",results[0].toString());
                    //xx console.log(" dataValue = ",results[1].toString());
                    inner_done();
                });

            }, done);
        });

        it("ClientSession#readVariableValue - case 3 - a single ReadValueId",  (done) => {

            perform_operation_on_client_session(client, endpointUrl,  (session, inner_done) => {
                const readValueId1 = {
                    nodeId: "ns=0;i=2258",
                    attributeId: opcua.AttributeIds.BrowseName
                };
                const readValueId2 = {
                    nodeId: "ns=0;i=2258",
                    attributeId: opcua.AttributeIds.NodeClass
                };

                session.readVariableValue([readValueId1, readValueId2],  (err, results) => {

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
