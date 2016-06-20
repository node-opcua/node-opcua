/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var coerceNodeId = opcua.coerceNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var VariantArrayType = opcua.VariantArrayType;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;

function exec_safely(func,done) {
    try{
        func();
    } catch(err) {
        console.log(err);
        done(err);
    }
}

module.exports = function (test) {
    describe("testing CALL SERVICE on a fake server exposing the temperature device", function () {

        var client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient({
                requestedSessionTimeout: 60000 // use long session time out
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

                var objectId = coerceNodeId("ns=0;i=2253");// server
                var methodId = coerceNodeId("ns=0;i=11492"); // GetMonitoredItem
                session.getArgumentDefinition(methodId, function (err, inputArguments, outputArguments) {

                    exec_safely(function(){
                        //xx console.log("inputArguments  ",inputArguments);
                        //xx console.log("outputArguments ",outputArguments);
                        inputArguments.length.should.equal(1);
                        outputArguments.length.should.equal(2);

                        inner_done(err);
                    },inner_done);
                });
            }, done);

        });

        it("Q2 should return BadNothingToDo when CallRequest has no method to call", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call([], function (err) {

                    exec_safely(function(){
                        should(err).not.equal(null);
                        err.should.be.instanceOf(Error);
                        err.message.should.match(/BadNothingToDo/);
                        inner_done();
                    },inner_done);
                });
            }, done);

        });


        it("Q3-0 should reports inputArgumentResults GOOD when CallRequest input is good", function (done) {

            var invalidSubscriptionID = 1;
            var methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{dataType: DataType.UInt32 ,arrayType: VariantArrayType.Scalar, value:  invalidSubscriptionID }] //OK
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                 session.call(methodToCalls, function (err, results) {
                        exec_safely(function(){

                            should(err).equal(null);

                            should(results).not.eql(null);


                            results[0].inputArgumentResults.length.should.eql(1);
                            results[0].inputArgumentResults[0].should.eql(StatusCodes.Good);

                            results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);

                            inner_done();
                         },inner_done);
                    });
            }, done);

        });

        it("Q3-1 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong DataType", function (done) {

            var invalidSubscriptionID = 1;
            var methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{dataType: DataType.String,arrayType: VariantArrayType.Scalar, value:  invalidSubscriptionID.toString() }] //
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function(){
                        should(err).equal(null);

                        should(results).not.eql(null);

                        results[0].statusCode.should.eql(StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    },inner_done);
                });

            }, done);

        });

        it("Q3-2 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong ArrayType", function (done) {

            // note : this test causes ProsysOPC Demo server 2.2.0.94 to report a ServiceFault with a internal error
            //        (this issue has been reported to Jouni)
            var invalidSubscriptionID = 1;
            var methodToCalls = [];
            methodToCalls.push({
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{dataType: DataType.UInt32,arrayType: VariantArrayType.Array, value:  [invalidSubscriptionID] }] // << WRONG TYPE
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function(){
                        should(err).equal(null);

                        should(results).not.eql(null);

                        results[0].statusCode.should.eql(StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    },inner_done);
                });

            }, done);

        });

        it("Q3-4 should handle multiple calls", function (done) {

            var many_calls = 50;
            var methodToCalls = [];
            for (var i = 0; i < many_calls; i++) {
                methodToCalls.push({
                    objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{dataType: DataType.UInt32, value:  1 }]
                });
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(many_calls);
                        results.map(function(result){
                            result.inputArgumentResults.length.should.eql(1);
                            result.inputArgumentResults[0].should.eql(StatusCodes.Good);
                        });

                        inner_done();
                    },inner_done);
                });

            }, done);

        });

        it("Q3-5 should return BadTooManyOperations when CallRequest has too many methods to call", function (done) {

            var too_many = 50000;
            var methodToCalls = [];
            for (var i = 0; i < too_many; i++) {
                methodToCalls.push({
                    objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{dataType: DataType.UInt32, value:  1 }]
                });
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function(){

                        if (err) {
                            err.should.be.instanceOf(Error);
                            err.message.should.match(/BadTooManyOperations/);
                        }
                        should(err).not.equal(null);
                        inner_done();
                    },inner_done);
                });

            }, done);

        });

        it("Q4 should succeed and return BadNodeIdInvalid when CallRequest try to address an node that is not an UAObject", function (done) {


            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=864"), //  Default Binary doesn't have methods
                methodId: coerceNodeId("ns=0;i=11489"),
                inputArguments: [{dataType: DataType.UInt32, value: [1]}]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(StatusCodes.BadNodeIdInvalid,StatusCodes.BadMethodInvalid);

                        inner_done();
                    },inner_done);
                });
            }, done);

        });

        it("Q5 should succeed and return BadNodeIdUnknown when CallRequest try to address an unknown object", function (done) {

            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;s=UnknownObject"),
                methodId: coerceNodeId("ns=0;s=UnknownMethod")
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(1);

                        results[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);

                        inner_done();
                    },inner_done);
                });
            }, done);

        });

        it("Q6 should succeed and return BadMethodInvalid when CallRequest try to address an unknwon method on a valid object", function (done) {

            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;s=unknown_method")
                // methodId: coerceNodeId("ns=0;s=11489")
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(StatusCodes.BadNodeIdInvalid,StatusCodes.BadMethodInvalid);

                        inner_done();
                    },inner_done);
                });
            }, done);

        });

        it("Q7 should succeed and return BadInvalidArgument when CallRequest has invalid arguments", function (done) {

            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [] // invalid => missing arg !
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(1);

                        results[0].statusCode.should.equalOneOf(StatusCodes.BadInvalidArgument,StatusCodes.BadArgumentsMissing);

                        inner_done();
                    },inner_done);
                });
            }, done);
        });


        it("Q8 should succeed and return BadTypeMismatch when CallRequest is GetMonitoredItem and has the argument with a wrong dataType ", function (done) {

            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [
                    {dataType: DataType.QualifiedName} // intentionally a wrong dataType here
                ]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {

                    exec_safely(function(){
                        should(err).equal(null);
                        results.length.should.eql(1);
                        results[0].statusCode.should.equalOneOf(StatusCodes.BadTypeMismatch,StatusCodes.BadInvalidArgument);

                        results[0].inputArgumentResults.should.be.instanceOf(Array);
                        results[0].inputArgumentResults.length.should.eql(1);
                        results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                        inner_done();
                    },inner_done);
                });
            }, done);

        });


        it("Q9 should succeed and return BadSubscriptionId when CallRequest is GetMonitoredItem and has valid arguments but invalid subscriptionId ", function (done) {

            opcua.MethodIds.Server_GetMonitoredItems.should.eql(11492);

            var subscriptionId = 100;
            var methodToCalls = [{
                objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem


                inputArguments: [
                    // subscriptionID( UInt32)
                    {dataType: DataType.UInt32, value: subscriptionId}
                ]
            }];

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.call(methodToCalls, function (err, results) {
                    exec_safely(function(){
                        if (!err) {
                            results.length.should.eql(1);
                            results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                        }

                        inner_done(err);
                    },inner_done);
                });
            }, done);

        });

        describe("GetMonitoredItems", function () {

            it("T1 A client should be able to call the GetMonitoredItems standard OPCUA command, and return BadSubscriptionId if input args subscriptionId is invalid ", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    var subscriptionId = 1000000; // invalid subscription ID

                    session.getMonitoredItems(subscriptionId, function (err, monitoredItems) {

                        exec_safely(function(){
                            should(err).not.eql(null);
                            err.message.should.match(/BadSubscriptionId/);
                            inner_done();
                        },inner_done);
                    });
                }, done);

            });


            it("T2 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and no monitored Item", function (done) {

                perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                    var subscriptionId = subscription.subscriptionId;

                    session.getMonitoredItems(subscriptionId, function (err, result) {
                        exec_safely(function(){
                            if (!err) {
                                should(result.serverHandles).be.instanceOf(Uint32Array);
                                should(result.clientHandles).be.instanceOf(Uint32Array);
                                result.serverHandles.length.should.eql(0);
                                result.clientHandles.length.should.eql(0);
                            }
                            inner_done(err);
                        },inner_done);
                    });
                }, done);

            });


            it("T3 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and one monitored Item", function (done) {

                perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                    var subscriptionId = subscription.subscriptionId;

                    var monitoredItem = subscription.monitor(
                        {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                        {samplingInterval: 10, discardOldest: true, queueSize: 1});

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {

                    });
                    monitoredItem.once("changed", function (value) {

                        session.getMonitoredItems(subscriptionId, function (err, result) {
                            exec_safely(function(){

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
                            },inner_done);
                        });
                    });

                }, done);

            });

            it("T4 GetMonitoredItem must have the Executable attribute set", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    var getMonitoredItemMethodId = "ns=0;i=11492";
                    var nodesToRead = [
                        {
                            nodeId: getMonitoredItemMethodId,
                            attributeId: AttributeIds.Executable
                        },
                        {
                            nodeId: getMonitoredItemMethodId,
                            attributeId: AttributeIds.UserExecutable
                        }
                    ];

                    session.read(nodesToRead, function (err, unused, dataValues, diagnosticInfos) {
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
            var getMonitoredItemMethodId = coerceNodeId("ns=0;i=11492");

            var hasPropertyRefId = resolveNodeId("HasProperty");
            /* NodeId  ns=0;i=46*/
            var browsePath = [{
                startingNode: /* NodeId  */ getMonitoredItemMethodId,
                relativePath: /* RelativePath   */  {
                    elements: /* RelativePathElement */ [
                        {
                            referenceTypeId: hasPropertyRefId,
                            isInverse: false,
                            includeSubtypes: false,
                            targetName: {namespaceIndex: 0, name: "InputArguments"}
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
                            targetName: {namespaceIndex: 0, name: "OutputArguments"}
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
