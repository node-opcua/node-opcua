import "should";
import { OPCUAClient, coerceNodeId, DataType, NodeId } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";

interface TestHarness { endpointUrl: string; [k: string]: any }

async function expectBuiltInDataType(endpointUrl: string, nodeId: NodeId, expected: DataType) {
    const client = OPCUAClient.create({});
    await client.withSessionAsync(endpointUrl, async (session) => {
        const dataType = await (session as any).getBuiltInDataType(nodeId);
        if (dataType !== expected) {
            throw new Error(`Expecting ${expected} got ${dataType}`);
        }
    });
}

export function t(test: TestHarness) {
    describe("Issue #273 - getBuiltInDataType variations", () => {
        it("GDT1 - Double", async () => {
            await expectBuiltInDataType(test.endpointUrl, coerceNodeId("ns=2;s=Scalar_Simulation_Double"), DataType.Double);
        });
        it("GDT2 - ImageGIF (ByteString)", async () => {
            await expectBuiltInDataType(test.endpointUrl, coerceNodeId("ns=2;s=Scalar_Simulation_ImageGIF"), DataType.ByteString);
        });
        it("GDT3 - Int64", async () => {
            await expectBuiltInDataType(test.endpointUrl, coerceNodeId("ns=2;s=Scalar_Simulation_Int64"), DataType.Int64);
        });
        it("GDT4 - QualifiedName", async () => {
            await expectBuiltInDataType(test.endpointUrl, coerceNodeId("ns=2;s=Scalar_Simulation_QualifiedName"), DataType.QualifiedName);
        });
        it("GDT5 - Fails on Object node (Server Object)", async () => {
            const nodeId = coerceNodeId("ns=0;i=2253");
            const client = OPCUAClient.create({});
            await assertThrow(async () => {
                await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                    await (session as any).getBuiltInDataType(nodeId);
                });
            }, /BadAttributeIdInvalid/i); // underlying implementation should throw some error; broad regex
        });
        it("GDT6 - promise form (#643)", async () => {
            await expectBuiltInDataType(test.endpointUrl, coerceNodeId("ns=2;s=Scalar_Simulation_Double"), DataType.Double);
        });
    });
}