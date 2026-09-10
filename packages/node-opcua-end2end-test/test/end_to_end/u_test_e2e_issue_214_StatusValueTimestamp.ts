import "should";
import {
    AttributeIds,
    DataChangeFilter,
    DataChangeTrigger,
    DataType,
    DataValue,
    DeadbandType,
    OPCUAClient,
    StatusCodes,
    TimestampsToReturn,
    Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session.js";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

// The single internal this test drives: setting the value without going through a write,
// so it can vary the timestamps alone. Declared structurally rather than imported, because
// UAVariableImpl is not part of node-opcua-address-space's public surface.
// the index range is typed as the null this test passes, so the declaration needs no
// dependency on node-opcua-numeric-range for a single argument
type WithInternalSetDataValue = { _internal_set_dataValue(dataValue: DataValue, indexRange: null): void };

export function t(test: UmbrellaTestContext) {
    describe("NXX1 Testing issue #214 - DataChangeTrigger.StatusValueTimestamp", () => {
        it("#214 - DataChangeTrigger.StatusValueTimestamp", async () => {
            const nodeId = "ns=2;s=Static_Scalar_Double";
            const variable = test.server!.engine.addressSpace!.findNode(nodeId) as unknown as WithInternalSetDataValue;
            const variant = new Variant({ dataType: DataType.Double, value: 3.14 });
            let nbChanges = 0;

            // interval updating timestamp only
            const timerId = setInterval(() => {
                const now = new Date();
                const dataValue = new DataValue({
                    serverPicoseconds: 0,
                    serverTimestamp: now,
                    sourcePicoseconds: 0,
                    sourceTimestamp: now,
                    statusCode: StatusCodes.Good,
                    value: variant
                });
                variable._internal_set_dataValue(dataValue, null);
            }, 100);

            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl!;

            try {
                await perform_operation_on_subscription_async(client, endpointUrl, async (_session, subscription) => {
                    const filter = new DataChangeFilter({
                        trigger: DataChangeTrigger.StatusValueTimestamp,
                        deadbandType: DeadbandType.Absolute,
                        deadbandValue: 1.0
                    });
                    const itemToMonitor = { nodeId, attributeId: AttributeIds.Value };
                    const parameters = { samplingInterval: 100, discardOldest: false, queueSize: 10000, filter };

                    const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);
                    monitoredItem.on("changed", () => {
                        nbChanges++;
                    });
                    // wait 2 seconds collection
                    await new Promise((r) => setTimeout(r, 2000));
                });
            } finally {
                clearInterval(timerId);
            }
            nbChanges.should.be.above(5);
        });
    });
}
