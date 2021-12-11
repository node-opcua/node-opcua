"use strict";

const async = require("async");
const should = require("should");
const { OPCUAClient, StatusCodes, AttributeIds } = require("node-opcua");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing bug #455 - OPCUASession#readVariableValue", function () {
        it("should detect badly formed nodeId on the client level and raise an exception", function (done) {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
                            function (callback) {
                                // in ths test we pass a INVALID nodeID (a.k.a a string that cannot be coerced to a NodeId)
                                // therefore this code will cause readVariableValue to raise a exception, before any
                                // transaction is sent to the server.
                                // The exception is the expected behavior
                                try {
                                    session.readVariableValue(
                                        "ns=2;i=INVALID_NODE_ID_THAT_SHOULD_CAUSE_EXCEPTION_IN_CLIENT",
                                        (err, dataValue) => {
                                            callback(new Error("Should Not Get Here"));
                                        }
                                    );
                                } catch (err) {
                                    callback();
                                }
                            },

                            function (callback) {
                                // in ths test we pass a VALID nodeID (a.k.a a string that can be coerced to a NodeId)
                                // but this node doesn't exists in the address space of the serve.
                                // therefore  readVariableValue will be executed, but the eerver will return a
                                // a dataValue with no Value and a StatusCode=BadNodeIdUnknown.
                                session.readVariableValue("ns=2;i=10000", (err, dataValue) => {
                                    dataValue.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                                    callback();
                                });
                            },
                            function (callback) {
                                // same behavior applies on standard read transaction
                                session.read({ nodeId: "ns=2;i=10000", attributeId: AttributeIds.Value }, (err, dataValue) => {
                                    dataValue.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                                    callback();
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });
    });
};
