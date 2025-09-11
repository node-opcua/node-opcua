import should from "should";
import {
    coerceNodeId,
    ClientMonitoredItem,
    MethodIds,
    DataType,
    VariantArrayType,
    StatusCodes,
    OPCUAClient,
    resolveNodeId,
    AttributeIds,
    Variant,
    CallMethodRequestOptions,
    ClientSession,
    BrowsePath
} from "node-opcua";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { BrowsePathOptions } from "../../../node-opcua-types/source";


async function exec_safely(func: () => Promise<void>) {
    try {
        await func();
    } catch (err) {
        console.log(err);
    }
}

export function t(test: any) {
    describe("testing CALL SERVICE on a fake server exposing the temperature device", function () {
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({
                requestedSessionTimeout: 600 * 1000, // use long session time out
            });
            endpointUrl = test.endpointUrl;
        });

        afterEach(() => {
        });

        it("Q1 should retrieve the inputArgument of a method using a OPCUA transaction getArgumentDefinition", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const objectId = coerceNodeId("ns=0;i=2253"); // server
                    const methodId = coerceNodeId("ns=0;i=11492"); // GetMonitoredItem

                    const args = await session.getArgumentDefinition(methodId);
                    const { inputArguments, outputArguments } = args;

                    inputArguments.length.should.equal(1);
                    inputArguments[0].name!.should.equal("SubscriptionId");
                    inputArguments[0].dataType.toString().should.equal("ns=0;i=7");

                    outputArguments.length.should.equal(2);
                    outputArguments[0].name!.should.equal("ServerHandles");
                    outputArguments[0].dataType.toString().should.equal("ns=0;i=7");

                    outputArguments[1].name!.should.equal("ClientHandles");
                    outputArguments[1].dataType.toString().should.equal("ns=0;i=7");

                });
        });

        it("Q2 should return BadNothingToDo when CallRequest has no method to call", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    await assertThrow(async () => {
                        await session.call([]);
                    }, /BadNothingToDo/);
                });
        });

        it("Q3-0 should reports inputArgumentResults GOOD when CallRequest input is good", async () => {
            const invalidSubscriptionID = 1;
            const methodsToCall: CallMethodRequestOptions[] = [];
            methodsToCall.push({
                objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: invalidSubscriptionID }] //OK
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results[0].inputArgumentResults!.length.should.eql(1);
                    results[0].inputArgumentResults![0].should.eql(StatusCodes.Good);
                    results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                    results[0].outputArguments!.length.should.eql(0);
                });
        });

        it("Q3-2b should reports inputArgumentResults GOOD when CallRequest input is good", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const methodsToCall: CallMethodRequestOptions[] = [];
                    methodsToCall.push({
                        objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                        methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                        inputArguments: [
                            { dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: subscription.subscriptionId }
                        ] //OK
                    });

                    const results = await session.call(methodsToCall);

                    results[0].inputArgumentResults!.length.should.eql(1);
                    results[0].inputArgumentResults![0].should.eql(StatusCodes.Good);

                    results[0].statusCode.should.eql(StatusCodes.Good);

                    results[0].outputArguments!.length.should.eql(2);
                    results[0].outputArguments![0].should.be.instanceOf(Variant);
                    results[0].outputArguments![1].should.be.instanceOf(Variant);
                });
        });

        it("Q3-1 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong DataType", async () => {
            const invalidSubscriptionID = 1;
            const methodsToCall: CallMethodRequestOptions[] = [];
            methodsToCall.push({
                objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [
                    {
                        dataType: DataType.String,
                        arrayType: VariantArrayType.Scalar,
                        value: invalidSubscriptionID.toString()
                    }
                ]
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results[0].statusCode.should.eql(StatusCodes.BadTypeMismatch);
                    results[0].inputArgumentResults!.length.should.eql(1);
                    results[0].inputArgumentResults![0].should.eql(StatusCodes.BadTypeMismatch);
                });
        });

        it("Q3-2 should return BadInvalidArgument /  BadTypeMismatch when CallRequest input argument has the wrong ArrayType", async () => {
            // note : this test causes ProsysOPC Demo server 2.2.0.94 to report a ServiceFault with a internal error
            //        (this issue has been reported to Jouni)
            const invalidSubscriptionID = 1;
            const methodsToCall: CallMethodRequestOptions[] = [];
            methodsToCall.push({
                objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                inputArguments: [{ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [invalidSubscriptionID] }] // << WRONG TYPE
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results[0].statusCode.should.eql(StatusCodes.BadTypeMismatch);
                    results[0].inputArgumentResults!.length.should.eql(1);
                    results[0].inputArgumentResults![0].should.eql(StatusCodes.BadTypeMismatch);
                });
        });

        it("Q3-4 should handle multiple calls", async () => {
            const many_calls = 50;
            const methodsToCall: CallMethodRequestOptions[] = [];
            for (let i = 0; i < many_calls; i++) {
                methodsToCall.push({
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{ dataType: DataType.UInt32, value: 1 }]
                });
            }

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results.length.should.eql(many_calls);
                    results.map(function (result) {
                        result.inputArgumentResults!.length.should.eql(1);
                        result.inputArgumentResults![0].should.eql(StatusCodes.Good);
                    });
                });
        });

        it("Q3-5 should return BadTooManyOperations when CallRequest has too many methods to call", async () => {
            const too_many = 5000;
            const methodsToCall: CallMethodRequestOptions[] = [];
            for (let i = 0; i < too_many; i++) {
                methodsToCall.push({
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [{ dataType: DataType.UInt32, value: 1 }]
                });
            }

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    await assertThrow(async () => {
                        const results = await session.call(methodsToCall);
                    }, /BadTooManyOperations/);
                });
        });

        it("Q4 should succeed and return BadNodeIdInvalid when CallRequest try to address an node that is not an UAObject", async () => {
            const methodsToCall = [
                {
                    objectId: resolveNodeId("Server_ServerStatus_CurrentTime"), //  a Variable doesn't have methods
                    methodId: coerceNodeId("ns=0;i=11489"),
                    inputArguments: [{ dataType: DataType.UInt32, value: [1] }]
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results.length.should.eql(1);

                    results[0].statusCode.should.equalOneOf(
                        StatusCodes.BadInvalidArgument,
                        StatusCodes.BadNodeIdInvalid,
                        StatusCodes.BadMethodInvalid
                    );
                });
        });

        it("Q5 should succeed and return BadNodeIdUnknown when CallRequest try to address an unknown object", async () => {
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;s=UnknownObject"),
                    methodId: coerceNodeId("ns=0;s=UnknownMethod")
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);

                    results.length.should.eql(1);
                    results[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                });
        });

        it("Q6 should succeed and return BadMethodInvalid when CallRequest try to address an unknwon method on a valid object", async () => {
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;s=unknown_method")
                    // methodId: coerceNodeId("ns=0;s=11489")
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results.length.should.eql(1);

                    results[0].statusCode.should.equalOneOf(
                        StatusCodes.BadNodeIdUnknown,
                        StatusCodes.BadNodeIdInvalid,
                        StatusCodes.BadMethodInvalid
                    );
                });
        });

        it("Q7 should succeed and return BadInvalidArgument when CallRequest has invalid arguments", async () => {
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [] // invalid => missing arg !
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);

                    results.length.should.eql(1);

                    results[0].statusCode.should.equalOneOf(
                        StatusCodes.BadInvalidArgument,
                        StatusCodes.BadArgumentsMissing
                    );
                });
        });

        it("Q8 should succeed and return BadTypeMismatch when CallRequest is GetMonitoredItem and has the argument with a wrong dataType ", async () => {
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: [
                        { dataType: DataType.QualifiedName } // intentionally a wrong dataType here
                    ]
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);

                    results.length.should.eql(1);
                    results[0].statusCode.should.equalOneOf(StatusCodes.BadTypeMismatch, StatusCodes.BadInvalidArgument);

                    results[0].inputArgumentResults!.should.be.instanceOf(Array);
                    results[0].inputArgumentResults!.length.should.eql(1);
                    results[0].inputArgumentResults![0].should.eql(StatusCodes.BadTypeMismatch);
                });
        });

        it("Q9 should succeed and return BadSubscriptionId when CallRequest is GetMonitoredItem and has valid arguments but invalid subscriptionId ", async () => {
            MethodIds.Server_GetMonitoredItems.should.eql(11492);

            const subscriptionId = 100;
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem

                    inputArguments: [
                        // subscriptionID( UInt32)
                        { dataType: DataType.UInt32, value: subscriptionId }
                    ]
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results.length.should.eql(1);
                    results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                });
        });

        it("QA should succeed and return BadArgumentsMissing when CallRequest as a missing argument", async () => {
            MethodIds.Server_GetMonitoredItems.should.eql(11492);

            const subscriptionId = 100;
            const methodsToCall = [
                {
                    objectId: coerceNodeId("ns=0;i=2253"), // SERVER
                    methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
                    inputArguments: []
                }
            ];

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.call(methodsToCall);
                    results.length.should.eql(1);
                    results[0].statusCode.should.eql(StatusCodes.BadArgumentsMissing);
                });
        });

        interface ClientSessionEx extends ClientSession {
            getMonitoredItems(subscriptionId: number): Promise<{ serverHandles: any[], clientHandles: any[] }>;
        }
        describe("GetMonitoredItems", function () {
            it("T1 A client should be able to call the GetMonitoredItems standard OPCUA command, and return BadSubscriptionId if input args subscriptionId is invalid ", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
                        const subscriptionId = 1000000; // invalid subscription ID

                        await assertThrow(async () => {
                            const monitoredItems = await (session as ClientSessionEx).getMonitoredItems(subscriptionId);

                        }, /BadSubscriptionId/)
                    });
            });

            it("T2 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and no monitored Item", async () => {
                await perform_operation_on_subscription(
                    client,
                    endpointUrl,
                    async (session, subscription) => {
                        const subscriptionId = subscription.subscriptionId;

                        const result = await (session as ClientSessionEx).getMonitoredItems(subscriptionId);
                        should(result.serverHandles).be.instanceOf(Uint32Array);
                        should(result.clientHandles).be.instanceOf(Uint32Array);
                        result.serverHandles.length.should.eql(0);
                        result.clientHandles.length.should.eql(0);
                    });
            });

            it("T3 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and one monitored Item", async () => {
                await perform_operation_on_subscription(
                    client,
                    endpointUrl,
                    async (session, subscription) => {
                        const subscriptionId = subscription.subscriptionId;

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                            { samplingInterval: 10, discardOldest: true, queueSize: 1 }
                        );

                        // subscription.on("item_added",function(monitoredItem){
                        monitoredItem.on("initialized", function () {/** */ });

                        await new Promise<void>((resolve) => {
                            monitoredItem.once("changed", resolve);
                        });

                        const result = await (session as ClientSessionEx).getMonitoredItems(subscriptionId);

                        should(result.serverHandles).be.instanceOf(Uint32Array);
                        should(result.clientHandles).be.instanceOf(Uint32Array);
                        result.serverHandles.length.should.eql(1);
                        result.clientHandles.length.should.eql(1);
                        //xx console.log("serverHandles = ",result.serverHandles);
                        //xx console.log("clientHandles = ",result.clientHandles);
                        // lets stop monitoring this item
                        await monitoredItem.terminate();
                    });
            });

            it("T4 GetMonitoredItem must have the Executable attribute set", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
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

                        const dataValues = await session.read(nodesToRead);
                        dataValues[0].statusCode.should.eql(StatusCodes.Good);
                        dataValues[0].value.dataType.should.eql(DataType.Boolean);
                        dataValues[0].value.value.should.eql(true);
                        dataValues[1].statusCode.should.eql(StatusCodes.Good);
                        dataValues[1].value.dataType.should.eql(DataType.Boolean);
                        dataValues[1].value.value.should.eql(true);
                    });
            });
        });

        it("should find the OutputArguments and InputArguments Properties with a translate browse path request (like UAExpert)", async () => {
            // note : this is how UAExpert tries to figure out what are the input and output arguments definition
            const getMonitoredItemMethodId = coerceNodeId("ns=0;i=11492");

            const hasPropertyRefId = resolveNodeId("HasProperty");
            /* NodeId  ns=0;i=46*/
            const browsePaths: BrowsePathOptions[] = [
                {
                    startingNode: /* NodeId  */ getMonitoredItemMethodId,
                    relativePath: /* RelativePath   */ {
                        elements: /* RelativePathElement */[
                            {
                                referenceTypeId: hasPropertyRefId,
                                isInverse: false,
                                includeSubtypes: false,
                                targetName: { namespaceIndex: 0, name: "InputArguments" }
                            }
                        ]
                    }
                },
                {
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

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const results = await session.translateBrowsePath(browsePaths);
                    //xx console.log(results[0].toString());
                    results[0].statusCode.should.eql(StatusCodes.Good);
                    results[0].targets!.length.should.eql(1);
                    results[0].targets![0].targetId.toString().should.eql("ns=0;i=11493");

                    //xx console.log(results[1].toString());
                    results[1].statusCode.should.eql(StatusCodes.Good);
                    results[1].targets!.length.should.eql(1);
                    results[1].targets![0].targetId.toString().should.eql("ns=0;i=11494");

                });
        });
    });
};
