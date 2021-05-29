/*global describe, it, require*/
"use strict";
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const AttributeIds = opcua.AttributeIds;
const resolveNodeId = opcua.resolveNodeId;
const coerceNodeId = opcua.coerceNodeId;
const StatusCodes = opcua.StatusCodes;
const DataType = opcua.DataType;
const VariantArrayType = opcua.VariantArrayType;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

function exec_safely(func, done) {
    try {
        func();
    } catch (err) {
        console.log(err);
        done(err);
    }
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {
    describe("testing CALL SERVICE on a fake server exposing the temperature device", function () {

        let client, endpointUrl;

        beforeEach(function (done) {
            client = OPCUAClient.create({
                requestedSessionTimeout: 600 * 1000 // use long session time out
            });
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });



        it("Q1 should retrieve the inputArgument of a method using a OPCUA transaction getArgumentDefinition", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                const objectId = coerceNodeId("ns=0;i=2253");// server
                const methodId = coerceNodeId("ns=0;i=11492"); // GetMonitoredItem
                session.getArgumentDefinition(methodId, function (err, args) {

                    const inputArguments = args.inputArguments;
                    const outputArguments = args.outputArguments;

                    exec_safely(function () {
                        //xx console.log("inputArguments  ",inputArguments.toString());
                        //xx console.log("outputArguments ",outputArguments.toString());
                        inputArguments.length.should.equal(1);
                        inputArguments[0].name.should.equal("SubscriptionId");
                        inputArguments[0].dataType.toString().should.equal("ns=0;i=7");

                        outputArguments.length.should.equal(2);
                        outputArguments[0].name.should.equal("ServerHandles");
                        outputArguments[0].dataType.toString().should.equal("ns=0;i=7");

                        outputArguments[1].name.should.equal("ClientHandles");
                        outputArguments[1].dataType.toString().should.equal("ns=0;i=7");

                        inner_done(err);
                    }, inner_done);
                });
            }, done);

        });

        it("Q2 should return BadNothingToDo when CallRequest has no method to call", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call([], function (err) {

                    exec_safely(function () {
                        should.exist(err);
                        err.should.be.instanceOf(Error);
                        err.message.should.match(/BadNothingToDo/);
                        inner_done();
                    }, inner_done);
                });
            }, done);

        });


        it("Q3-0 should reports inputArgumentResults GOOD when CallRequest input is good", function (done) {

            const invalidSubscriptionID = 1;
            const methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: invalidSubscriptionID }] //OK
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {

                        should.not.exist(err);

                        should.exist(results);


                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.Good);

                        results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);

                        results[0].outputArguments.length.should.eql(0);

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });
        it("Q3-2b should reports inputArgumentResults GOOD when CallRequest input is good", function (done) {


            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {


                const methodToCalls = [];
                methodToCalls.push({
                    objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: subscription.subscriptionId }] //OK
                });

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {

                        should.not.exist(err);

                        should.exist(results);


                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.Good);

                        results[0].statusCode.should.eql(StatusCodes.Good);

                        results[0].outputArguments.length.should.eql(2);
                        results[0].outputArguments[0].should.be.instanceOf(opcua.Variant);
                        results[0].outputArguments[1].should.be.instanceOf(opcua.Variant);

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });

        it("Q3-1 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong DataType", function (done) {

            const invalidSubscriptionID = 1;
            const methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [
                    {
                        dataType: DataType.String,
                        arrayType: VariantArrayType.Scalar,
                        value: invalidSubscriptionID.toString()
                    }] //
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {
                        should.not.exist(err);

                        should.exist(results);

                        results[0].statusCode.should.eql(StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    }, inner_done);
                });

            }, done);

        });

        it("Q3-2 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong ArrayType", function (done) {

            // note : this test causes ProsysOPC Demo server 2.2.0.94 to report a ServiceFault with a internal error
            //        (this issue has been reported to Jouni)
            const invalidSubscriptionID = 1;
            const methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [invalidSubscriptionID] }] // << WRONG TYPE
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {
                        should.not.exist(err);
                        should.exist(results);

                        results[0].statusCode.should.eql(StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    }, inner_done);
                });

            }, done);

        });

        it("Q3-4 should handle multiple calls", function (done) {

            const many_calls = 50;
            const methodToCalls = [];
            for (let i = 0; i < many_calls; i++) {
                methodToCalls.push({
                    objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{ dataType: DataType.UInt32, value: 1 }]
                });
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {
                        should.not.exist(err);
                        results.length.should.eql(many_calls);
                        results.map(function (result) {
                            result.inputArgumentResults.length.should.eql(1);
                            result.inputArgumentResults[0].should.eql(StatusCodes.Good);
                        });

                        inner_done();
                    }, inner_done);
                });

            }, done);

        });

        it("Q3-5 should return BadTooManyOperations when CallRequest has too many methods to call", function (done) {

            const too_many = 50000;
            const methodToCalls = [];
            for (let i = 0; i < too_many; i++) {
                methodToCalls.push({
                    objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{ dataType: DataType.UInt32, value: 1 }]
                });
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function () {
                        should.exist(err);
                        if (err) {
                            err.should.be.instanceOf(Error);
                            err.message.should.match(/BadTooManyOperations/);
                        }

                        inner_done();
                    }, inner_done);
                });

            }, done);

        });

        it("Q4 should succeed and return BadNodeIdInvalid when CallRequest try to address an node that is not an UAObject", function (done) {


            const methodToCalls = [{
                objectId: resolveNodeId("Server_ServerStatus_CurrentTime"), //  a Variable doesn't have methods
                methodId: coerceNodeId("ns=0;i=11489"),
                inputArguments: [{ dataType: DataType.UInt32, value: [1] }]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function () {
                        should.not.exist(err);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(
                            StatusCodes.BadInvalidArgument,
                            StatusCodes.BadNodeIdInvalid,
                            StatusCodes.BadMethodInvalid);

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });

        it("Q5 should succeed and return BadNodeIdUnknown when CallRequest try to address an unknown object", function (done) {

            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;s=UnknownObject"),
                methodId: coerceNodeId("ns=0;s=UnknownMethod")
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, (err, results) => {
                    exec_safely(() => {
                        should.not.exist(err);
                        results.length.should.eql(1);

                        results[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });

        it("Q6 should succeed and return BadMethodInvalid when CallRequest try to address an unknwon method on a valid object", function (done) {

            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;s=unknown_method")
                // methodId: coerceNodeId("ns=0;s=11489")
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function () {
                        should.not.exist(err);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(
                            StatusCodes.BadNodeIdUnknown,
                            StatusCodes.BadNodeIdInvalid,
                            StatusCodes.BadMethodInvalid
                        );

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });

        it("Q7 should succeed and return BadInvalidArgument when CallRequest has invalid arguments", function (done) {

            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [] // invalid => missing arg !
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {
                        should.not.exist(err);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(StatusCodes.BadInvalidArgument, StatusCodes.BadArgumentsMissing);

                        inner_done();
                    }, inner_done);
                });
            }, done);
        });


        it("Q8 should succeed and return BadTypeMismatch when CallRequest is GetMonitoredItem and has the argument with a wrong dataType ", function (done) {

            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [
                    { dataType: DataType.QualifiedName } // intentionally a wrong dataType here
                ]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function () {
                        should.not.exist(err);
                        results.length.should.eql(1);
                        results[0].statusCode.should.equalOneOf(StatusCodes.BadTypeMismatch, StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.should.be.instanceOf(Array);
                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    }, inner_done);
                });
            }, done);

        });


        it("Q9 should succeed and return BadSubscriptionId when CallRequest is GetMonitoredItem and has valid arguments but invalid subscriptionId ", function (done) {

            opcua.MethodIds.Server_GetMonitoredItems.should.eql(11492);

            const subscriptionId = 100;
            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem


                inputArguments: [
                    // subscriptionID( UInt32)
                    { dataType: DataType.UInt32, value: subscriptionId }
                ]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function () {
                        if (!err) {
                            results.length.should.eql(1);
                            results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                        }

                        inner_done(err);
                    }, inner_done);
                });
            }, done);

        });

        it("QA should succeed and return BadArgumentsMissing when CallRequest as a missing argument", function (done) {
            opcua.MethodIds.Server_GetMonitoredItems.should.eql(11492);

            const subscriptionId = 100;
            const methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [
                ]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function () {
                        if (!err) {
                            results.length.should.eql(1);
                            results[0].statusCode.should.eql(StatusCodes.BadArgumentsMissing);
                        }

                        inner_done(err);
                    }, inner_done);
                });
            }, done);
        });

        describe("GetMonitoredItems", function () {

            it("T1 A client should be able to call the GetMonitoredItems standard OPCUA command, and return BadSubscriptionId if input args subscriptionId is invalid ", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    const subscriptionId = 1000000; // invalid subscription ID

                    session.getMonitoredItems(subscriptionId, function (err, monitoredItems) {

                        exec_safely(function () {
                            should.exist(err);
                            err.message.should.match(/BadSubscriptionId/);
                            inner_done();
                        }, inner_done);
                    });
                }, done);

            });


            it("T2 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and no monitored Item", function (done) {

                perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                    const subscriptionId = subscription.subscriptionId;

                    session.getMonitoredItems(subscriptionId, function (err, result) {
                        exec_safely(function () {
                            if (!err) {
                                should(result.serverHandles).be.instanceOf(Uint32Array);
                                should(result.clientHandles).be.instanceOf(Uint32Array);
                                result.serverHandles.length.should.eql(0);
                                result.clientHandles.length.should.eql(0);
                            }
                            inner_done(err);
                        }, inner_done);
                    });
                }, done);

            });


            it("T3 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and one monitored Item", function (done) {

                perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                    const subscriptionId = subscription.subscriptionId;

                    const monitoredItem = opcua.ClientMonitoredItem.create(subscription,
                        { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                        { samplingInterval: 10, discardOldest: true, queueSize: 1 });

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {

                    });
                    monitoredItem.once("changed", function (value) {

                        session.getMonitoredItems(subscriptionId, function (err, result) {
                            exec_safely(function () {

                                if (!err) {
                                    should(result.serverHandles).be.instanceOf(Uint32Array);
                                    should(result.clientHandles).be.instanceOf(Uint32Array);
                                    result.serverHandles.length.should.eql(1);
                                    result.clientHandles.length.should.eql(1);
                                }
                                //xx console.log("serverHandles = ",result.serverHandles);
                                //xx console.log("clientHandles = ",result.clientHandles);
                                // lets stop monitoring this item
                                monitoredItem.terminate(function () {
                                    inner_done(err);
                                });
                            }, inner_done);
                        });
                    });

                }, done);

            });

            it("T4 GetMonitoredItem must have the Executable attribute set", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    const getMonitoredItemMethodId = "ns=0;i=11492";
                    const nodesToRead = [
                        {
                            nodeId: getMonitoredItemMethodId,
                            attributeId: AttributeIds.Executable
                        },
                        {
                            nodeId: getMonitoredItemMethodId,
                            attributeId: AttributeIds.UserExecutable
                        }
                    ];

                    session.read(nodesToRead, function (err, dataValues, diagnosticInfos) {
                        if (!err) {
                            dataValues[0].statusCode.should.eql(StatusCodes.Good);
                            dataValues[0].value.dataType.should.eql(DataType.Boolean);
                            dataValues[0].value.value.should.eql(true);
                            dataValues[1].statusCode.should.eql(StatusCodes.Good);
                            dataValues[1].value.dataType.should.eql(DataType.Boolean);
                            dataValues[1].value.value.should.eql(true);
                        }
                        inner_done(err);
                    });

                }, done);
            });
        });

        it("should find the OutputArguments and InputArguments Properties with a translate browse path request (like UAExpert)", function (done) {

            // note : this is how UAExpert tries to figure out what are the input and output arguments definition
            const getMonitoredItemMethodId = coerceNodeId("ns=0;i=11492");

            const hasPropertyRefId = resolveNodeId("HasProperty");
            /* NodeId  ns=0;i=46*/
            const browsePath = [{
                startingNode: /* NodeId  */ getMonitoredItemMethodId,
                relativePath: /* RelativePath   */  {
                    elements: /* RelativePathElement */[
                        {
                            referenceTypeId: hasPropertyRefId,
                            isInverse: false,
                            includeSubtypes: false,
                            targetName: { namespaceIndex: 0, name: "InputArguments" }
                        }
                    ]
                }
            }, {
                startingNode: getMonitoredItemMethodId,
                relativePath: {
                    elements: [
                        {
                            referenceTypeId: hasPropertyRefId,
                            isInverse: false,
                            includeSubtypes: false,
                            targetName: { namespaceIndex: 0, name: "OutputArguments" }
                        }
                    ]
                }
            }
            ];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                session.translateBrowsePath(browsePath, function (err, results) {

                    //xx console.log(results[0].toString());
                    results[0].statusCode.should.eql(StatusCodes.Good);
                    results[0].targets.length.should.eql(1);
                    results[0].targets[0].targetId.toString().should.eql("ns=0;i=11493");

                    //xx console.log(results[1].toString());
                    results[1].statusCode.should.eql(StatusCodes.Good);
                    results[1].targets.length.should.eql(1);
                    results[1].targets[0].targetId.toString().should.eql("ns=0;i=11494");

                    inner_done(err);

                });
            }, done);
        });


    });
};
