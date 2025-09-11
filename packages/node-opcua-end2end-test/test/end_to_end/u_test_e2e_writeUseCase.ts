import should from "should";
import {
    makeNodeId,
    DataType,
    AttributeIds,
    OPCUAClient,
    StatusCodes,
    WriteRequest,
    DataValue
} from "node-opcua";
import {
    perform_operation_on_client_session
} from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";

export function t(test: any) {

   
    describe("end-to-end testing of a write operation between a client and a server (session#write)", function () {
        let client: OPCUAClient;
        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(function (done) {
        });

        it("should return BadNodeIdUnknown if nodeId is unknown ", async () => {

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const unknown_nodeid = makeNodeId(7777, 8788);
                const nodesToWrite = [
                    {
                        nodeId: unknown_nodeid,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0 }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.BadNodeIdUnknown);

            });
        });

        it("should return Good if nodeId is known but not writeable ", async () => {

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const pumpSpeedId = "ns=1;b=0102030405060708090a0b0c0d0e0f10";

                const nodesToWrite = [
                    {
                        nodeId: pumpSpeedId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0 }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.BadNotWritable);

            });
        });

        it("should return Good if nodeId is known and writable ", async () => {

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const setPointTemperatureId = "ns=1;s=SetPointTemperature";

                const nodesToWrite = [
                    {
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 10.0 }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
            });

        });

        it("should return an error if value to write has a wrong dataType", async () => {

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const setPointTemperatureId = "ns=1;s=SetPointTemperature";

                const nodesToWrite = [
                    {
                        nodeId: setPointTemperatureId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {
                                /* Variant */
                                dataType: DataType.String,
                                value: "This is a string, but should be a Float"
                            }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.BadTypeMismatch);

            });
        });

        it("should return an error if value to write has a wrong dataType ( Double  instead of Float)", async () => {

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const float_Node = "ns=2;s=Scalar_Simulation_Float";

                const nodesToWrite = [
                    {
                        nodeId: float_Node,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 2 }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.BadTypeMismatch);

            });
        });

        it("server should return Good_CompletesAsynchronously if the  variable write operation happens asynchronously", async () => {

            // The value was successfully written to an intermediate system but the Server does not know if
            // the data source was updated properly.


            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const asyncNodeId = "ns=1;s=AsynchronousVariable";

                const nodesToWrite = [
                    {
                        nodeId: asyncNodeId,
                        attributeId: AttributeIds.Value,
                        value: /*new DataValue(*/{
                            value: {/* Variant */dataType: DataType.Double, value: 23.0 }
                        }
                    }
                ];

                const statusCodes = await session.write(nodesToWrite);
                //xx console.log(statusCodes);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.GoodCompletesAsynchronously);
            });
        });

        it("should return BadNothingToDo if writeRequest is empty", async () => {
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                await assertThrow(async () => {
                    const statusCodes = await session.write([]);
                }, /BadNothingToDo/);
            });
        });


        it("should return BadNothingToDo if writeRequest is null", async () => {
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const request = new WriteRequest({ nodesToWrite: [] });
                request.nodesToWrite = null;
                await assertThrow(async () => {
                    (session as any).performMessageTransaction(request);

                }, /BadNothingToDo/);
            });
        });

        it("MMM should return BadTooManyOperation if nodesToWrite has too many elements", async () => {

            test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite = 3;

            test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite.should.be.greaterThan(1);

            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const nodeToWrite = {
                    nodeId: null,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: DataType.Double, value: 23.0 }
                    }
                };
                const nodesToWrite = [
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,
                    nodeToWrite,

                ];
                const request = new WriteRequest({ nodesToWrite: nodesToWrite });

                await assertThrow(async () => {
                    (session as any).performMessageTransaction(request);
                }, /BadTooManyOperations/);

                // restore limit to zero
                test.server.engine.serverCapabilities.operationLimits.maxNodesPerWrite = 0;
            });

        });

        it("VQT should write Value Quality Timestamp - on basic variable", async () => {

            const setPointTemperatureId = "ns=1;s=SetPointTemperature";
            // Value, Quality, sourceTimestamp
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {

                const date = new Date();
                date.setTime(date.getTime() + 3);

                const nodesToWrite = [{
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value,
                    value: new DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 1120,
                        statusCode: StatusCodes.GoodLocalOverride
                    })
                }];

                //xx console.log(" requested source timestamp =", date.getTime());

                const statusCodes = await session.write(nodesToWrite);
                //xx console.log(statusCodes);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.Good);

                const nodeToRead = {
                    nodeId: setPointTemperatureId,
                    attributeId: AttributeIds.Value
                };
                const dataValue = await session.read(nodeToRead);
                //xx console.log("====", results[0].sourceTimestamp.getTime());
                //xx console.log(results[0].toString());
                dataValue.sourceTimestamp!.getTime().should.eql(date.getTime());
                dataValue.sourcePicoseconds.should.eql(1120);
                dataValue.statusCode.should.eql(StatusCodes.GoodLocalOverride);
            });
        });

        it("VQT should write Value Quality Timestamp - on async variable that support full blown dataValue write", async () => {

            
            const asyncNodeId = "ns=1;s=AsynchronousFullVariable";

            // Value, Quality, sourceTimestamp
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {


                const date = new Date();
                date.setTime(date.getTime() + 3);

                const nodesToWrite = [{
                    nodeId: asyncNodeId,
                    attributeId: AttributeIds.Value,
                    value: new DataValue({
                        value: {
                            /* Variant */dataType: DataType.Double, value: -23.0
                        },
                        sourceTimestamp: date,
                        sourcePicoseconds: 1120,
                        statusCode: StatusCodes.UncertainSensorNotAccurate
                    })
                }];

                //xx console.log(" requested source timestamp =", date.getTime());

                const statusCodes = await session.write(nodesToWrite);
                statusCodes.length.should.equal(nodesToWrite.length);
                statusCodes[0].should.eql(StatusCodes.Good);

                const nodeToRead = {
                    nodeId: asyncNodeId,
                    attributeId: AttributeIds.Value
                };

                const dataValue = await session.read(nodeToRead);
                //xx console.log(" server    source timestamp =",results[0].sourceTimestamp.getTime());
                //xx console.log(results[0].toString());
                dataValue.sourceTimestamp!.getTime().should.eql(date.getTime());
                dataValue.sourcePicoseconds.should.eql(1120); // we're only accurate at 10th of a picosecond
                dataValue.statusCode.should.eql(StatusCodes.UncertainSensorNotAccurate);
            });
        });

    });
};
