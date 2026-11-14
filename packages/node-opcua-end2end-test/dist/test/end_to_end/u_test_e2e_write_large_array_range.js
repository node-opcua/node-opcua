import { AttributeIds, OPCUAClient } from "node-opcua";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session.js";
export function t(test) {
    describe("write multi-dimensional-array", () => {
        let client;
        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(() => {
            client = undefined;
        });
        it("MDA-1 DA", async () => {
            await perform_operation_on_subscription_async(client, test.endpointUrl, async (session, _subscription) => {
                const namespaceArray = await session.readNamespaceArray();
                const simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");
                const nodeId = `ns=${simulationNamespaceIndex};s=Static_MultiDimensional_Array_Float`;
                const _dataValue = await session.read({
                    nodeId,
                    attributeId: AttributeIds.Value
                });
                //  console.log("Here", dataValue.toString());
                const _status = await session.write({
                    nodeId,
                    attributeId: AttributeIds.Value
                });
            });
        });
    });
}
//# sourceMappingURL=u_test_e2e_write_large_array_range.js.map