import "should";
import chalk from "chalk";
import {
    AttributeIds,
    DataType,
    DataValue,
    OPCUAClient,
    ReadRequest,
    sameDataValue,
    StatusCodes,
    TimestampsToReturn
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("JHJ1 end-to-end testing of read and write operation on a Variable", () => {
        let client: OPCUAClient; let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });

        afterEach(async () => {
            if (client) {
                await client.disconnect();
                // @ts-ignore
                client = null;
            }
        });

        async function test_write_read_cycle(dataValue: DataValue) {
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                const nodeId = "ns=2;s=Static_Scalar_Float";

                const nodesToWrite = [
                    {
                        nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: null,
                        value: dataValue
                    }
                ];
                const writeResult = await session.write(nodesToWrite as any); // array form -> StatusCode[]
                (writeResult as any).length.should.eql(1);
                (writeResult as any)[0].should.eql(StatusCodes.Good);

                const nodesToRead = [
                    {
                        nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: null,
                        dataEncoding: null
                    }
                ];
                const dataValues: DataValue[] = await session.read(nodesToRead as any) as any;
                // session.read with array returns an array of DataValue

                // if timestamps unspecified in original dataValue, adopt from server response
                if (!dataValue.serverTimestamp) {
                    dataValue.serverTimestamp = dataValues[0].serverTimestamp!;
                    dataValue.serverPicoseconds = dataValues[0].serverPicoseconds;
                }
                if (!dataValue.sourceTimestamp) {
                    dataValue.sourceTimestamp = dataValues[0].sourceTimestamp!;
                    dataValue.sourcePicoseconds = dataValues[0].sourcePicoseconds;
                }

                // server must provide timestamps
                dataValues[0].serverTimestamp!.should.be.instanceOf(Date);
                dataValues[0].sourceTimestamp!.should.be.instanceOf(Date);

                (dataValues[0].serverTimestamp!.getTime() + 1).should.be.greaterThan(dataValue.serverTimestamp!.getTime());

                // compare ignoring serverTimestamp
                dataValue.serverTimestamp = null as any;
                (dataValues[0] as any).serverTimestamp = null;
                if (!sameDataValue(dataValue, dataValues[0])) {
                    console.log(chalk.yellow(" ------- > expected"));
                    console.log(chalk.yellow(dataValue.toString()));
                    console.log(chalk.cyan(" ------- > actual"));
                    console.log(chalk.cyan(dataValues[0].toString()));
                    throw new Error("dataValue is not as expected");
                }
            });
        }

        it("writing dataValue case 1 - both serverTimestamp and sourceTimestamp are specified", async () => {
            const dataValue = new DataValue({
                serverTimestamp: new Date(2015, 5, 2),
                serverPicoseconds: 20,
                sourceTimestamp: new Date(2015, 5, 3),
                sourcePicoseconds: 30,
                value: { dataType: DataType.Float, value: 32.0 }
            });
            await test_write_read_cycle(dataValue);
        });

        it("writing dataValue case 2 - serverTimestamp is null & sourceTimestamp is specified", async () => {
            const dataValue = new DataValue({
                serverTimestamp: null as any,
                serverPicoseconds: 0,
                sourceTimestamp: new Date(2015, 5, 3),
                sourcePicoseconds: 30,
                value: { dataType: DataType.Float, value: 32.0 }
            });
            await test_write_read_cycle(dataValue);
        });

        it("writing dataValue case 3 - serverTimestamp is null & sourceTimestamp is null", async () => {
            const dataValue = new DataValue({
                serverTimestamp: null as any,
                serverPicoseconds: 0,
                sourceTimestamp: null as any,
                sourcePicoseconds: 0,
                value: { dataType: DataType.Float, value: 32.0 }
            });
            await test_write_read_cycle(dataValue);
        });

        it("ZZZ reading ns=2;s=Static_Scalar_Int16", async () => {
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                const nodeId = "ns=2;s=Static_Scalar_Int16";
                const nodesToRead = [
                    { nodeId, attributeId: AttributeIds.Value, indexRange: undefined, dataEncoding: null }
                ];
                const maxAge = 10;

                // perform 3 read transactions with differing timestampsToReturn
                const request1 = new ReadRequest({ nodesToRead: nodesToRead as any, maxAge, timestampsToReturn: TimestampsToReturn.Both });
                await (session as any).performMessageTransaction(request1);
                const request2 = new ReadRequest({ nodesToRead: nodesToRead as any, maxAge, timestampsToReturn: TimestampsToReturn.Both });
                await (session as any).performMessageTransaction(request2);
                const request3 = new ReadRequest({ nodesToRead: nodesToRead as any, maxAge, timestampsToReturn: TimestampsToReturn.Server });
                await (session as any).performMessageTransaction(request3);
            });
        });

        xit("#read test maxAge", () => { /* intentionally skipped */ });

        describe("Performance of reading large array", () => {
            it("PERF - READ testing performance of large array", async () => {
                await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                    const nodeId = "s=Static_Scalar_Large_Array_Float";
                    const nodeToRead = { nodeId, attributeId: AttributeIds.Value, indexRange: undefined, dataEncoding: null };
                    const dataValue: DataValue = await session.read(nodeToRead as any);
                    dataValue.should.be.instanceof(DataValue);
                });
            });

            it("PERF - WRITE testing performance of large array", async () => {
                await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                    const nodeId = "ns=2;s=Static_Scalar_Large_Array_Float";
                    const nodeToRead = { nodeId, attributeId: AttributeIds.Value, indexRange: undefined, dataEncoding: null };
                    const dataValue: DataValue = await session.read(nodeToRead as any);

                    const variant: any = dataValue.value;
                    variant.value[1] = 2; variant.value[3] = 2; variant.value[4] = 2;
                    const nodesToWrite = [ { nodeId, attributeId: AttributeIds.Value, indexRange: null, value: dataValue } ];
                    await session.write(nodesToWrite as any);

                    // ensure it's a Float32Array then write a large one
                    (nodesToWrite[0] as any).value.value.value.should.be.instanceof(Float32Array);
                    (nodesToWrite[0] as any).value.value.value = new Float32Array(1024 * 1024);
                    await session.write(nodesToWrite as any);
                    const dv2: DataValue = await session.read(nodeToRead as any);
                    dv2.should.be.instanceof(DataValue);
                });
            });
        });
    });
}
