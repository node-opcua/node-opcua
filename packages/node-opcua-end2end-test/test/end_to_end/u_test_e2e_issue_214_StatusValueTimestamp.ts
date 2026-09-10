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
import type { UAVariableImpl } from "node-opcua-address-space/impl/ua_variable_impl.js";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session.js";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

export function t(test: UmbrellaTestContext) {
    describe("NXX1 Testing issue #214 - DataChangeTrigger.StatusValueTimestamp", () => {
        // the variable value never changes: only its SourceTimestamp is refreshed
        async function countNotifications(filter: DataChangeFilter): Promise<number> {
            const nodeId = "ns=2;s=Static_Scalar_Double";
            const variable = test.server!.engine.addressSpace!.findNode(nodeId) as unknown as UAVariableImpl;
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
            return nbChanges;
        }

        it("#214 - DataChangeTrigger.StatusValueTimestamp - a SourceTimestamp change is reported when no Deadband is set", async () => {
            const nbChanges = await countNotifications(
                new DataChangeFilter({
                    trigger: DataChangeTrigger.StatusValueTimestamp,
                    deadbandType: DeadbandType.None,
                    deadbandValue: 0
                })
            );
            should(nbChanges).be.above(5);
        });

        it("#214 - DataChangeTrigger.StatusValueTimestamp - a Deadband makes it behave as STATUS_VALUE", async () => {
            // OPC 10000-4 (1.05) 7.22.2, STATUS_VALUE_TIMESTAMP_2:
            //   "If a Deadband filter is specified, this trigger has the same behaviour as STATUS_VALUE_1."
            // so a timestamp-only refresh must NOT be reported here: only the initial value is.
            const nbChanges = await countNotifications(
                new DataChangeFilter({
                    trigger: DataChangeTrigger.StatusValueTimestamp,
                    deadbandType: DeadbandType.Absolute,
                    deadbandValue: 1.0
                })
            );
            should(nbChanges).be.belowOrEqual(2);
        });
    });
}
