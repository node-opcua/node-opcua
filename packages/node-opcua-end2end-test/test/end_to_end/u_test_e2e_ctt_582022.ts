import "should";
import {
    OPCUAClient,
    coerceNodeId,
    AttributeIds,
    DataType,
    VariantArrayType,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * CTT case (AttributeWriteValue test7)
 * Write a ByteString value to a node of type Byte[] and expect it to succeed (no BadTypeMismatch).
 */
export function t(test: TestHarness) {
    describe("Testing ctt  - write a ByteString value to a node of type Byte[]", () => {
        it("should write a ByteString value into a node of type Byte[]", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            await perform_operation_on_subscription_async(client, endpointUrl, async (session: any, subscription: any) => {
                // 1. find simulator namespace index
                const namespaceArray: string[] = await session.readNamespaceArray();
                const simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");
                simulationNamespaceIndex.should.be.greaterThanOrEqual(0, "Simulator namespace not found");

                // 2. read initial value of the array-of-Byte variable
                const nodeId = coerceNodeId("s=Static_Array_Byte", simulationNamespaceIndex);
                const nodeToRead = { nodeId, attributeId: AttributeIds.Value };
                const dataValue = await session.read(nodeToRead);
                if (dataValue.statusCode.isNotGood()) {
                    throw new Error("Cannot read value " + dataValue.toString());
                }
                dataValue.value.value.length.should.be.greaterThan(2);
                const l: number = dataValue.value.value.length;

                // 3. write ByteString (scalar) into the Byte[] variable
                const nodeToWrite = {
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        value: {
                            dataType: DataType.ByteString,
                            arrayType: VariantArrayType.Scalar,
                            value: Buffer.from([l, 2, 3, 88])
                        }
                    }
                };
                const results: any[] = await session.write([nodeToWrite]);
                results[0].should.not.eql(StatusCodes.BadTypeMismatch);
                results[0].should.eql(StatusCodes.Good);
            });
        });
    });
}
