"use strict";

const should = require("should");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const coerceNodeId = opcua.coerceNodeId;
const DataType = opcua.DataType;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function(test) {

    function doTest(nodeId, expectedDataType, done) {
        const client = OPCUAClient.create();
        const endpointUrl = test.endpointUrl;

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            session.getBuiltInDataType(nodeId, function(err, dataType) {
                if (err) {
                    return inner_done(err);
                }
                if (dataType !== expectedDataType) {
                    return inner_done(new Error("Expecting " + expectedDataType.toString()));
                }
                inner_done();
            });
        }, done);

    }

    async function doTestAsync(nodeId, expectedDataType) {
        const client = OPCUAClient.create();
        const endpointUrl = test.endpointUrl;

        await client.withSessionAsync(endpointUrl, async (session) => {
           const dataType = await session.getBuiltInDataType(nodeId);
           if (dataType !== expectedDataType) {
               throw new Error("Expecting " + expectedDataType.toString());
           }
        });
    }

    describe("Testing issue#273 ", function() {

        it("GDT1- should be possible to find the DataType of node - Double ", function(done) {
            const nodeId = coerceNodeId("ns=2;s=Scalar_Simulation_Double");
            doTest(nodeId, DataType.Double, done);
        });
        it("GDT2- should be possible to find the DataType of  node - ImageGIF", function(done) {
            const nodeId = coerceNodeId("ns=2;s=Scalar_Simulation_ImageGIF");
            doTest(nodeId, DataType.ByteString, done);
        });
        it("GDT3- should be possible to find the DataType of simple node - Int64", function(done) {
            const nodeId = coerceNodeId("ns=2;s=Scalar_Simulation_Int64");
            doTest(nodeId, DataType.Int64, done);
        });
        it("GDT4- should be possible to find the DataType of simple - QualifiedName", function(done) {
            const nodeId = coerceNodeId("ns=2;s=Scalar_Simulation_QualifiedName");
            doTest(nodeId, DataType.QualifiedName, done);
        });

        it("GDT5- should fail  to find the DataType on a Object ( Server Object for instance)", function(done) {
            const nodeId = coerceNodeId("ns=0;i=2253"); // Server Object
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

                session.getBuiltInDataType(nodeId, function(err, dataType) {
                    if (!err) {
                        return inner_done(new Error("expecting a failure"));
                    }
                    inner_done();
                });
            }, done);
        });

        it("Should be possible to call getBuiltInDataType with Promise#643", async function() {
            const nodeId = coerceNodeId("ns=2;s=Scalar_Simulation_Double");
            await doTestAsync(nodeId, DataType.Double);

        });
    });
};
