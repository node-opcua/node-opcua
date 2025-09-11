import "should";
import {
    OPCUAClient,
    DataValue,
    Variant,
    DataType,
    StatusCodes,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType,
    AttributeIds,
    TimestampsToReturn,
    ClientMonitoredItem
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

export function t(test: TestHarness) {
    describe("NXX1 Testing issue #214 - DataChangeTrigger.StatusValueTimestamp", () => {
        it("#214 - DataChangeTrigger.StatusValueTimestamp", async () => {
            const nodeId = "ns=2;s=Static_Scalar_Double";
            const variable: any = test.server.engine.addressSpace.findNode(nodeId);
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
            const endpointUrl = test.endpointUrl;

            try {
                await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                    const filter = new DataChangeFilter({
                        trigger: DataChangeTrigger.StatusValueTimestamp,
                        deadbandType: DeadbandType.Absolute,
                        deadbandValue: 1.0
                    });
                    const itemToMonitor = { nodeId, attributeId: AttributeIds.Value };
                    const parameters = { samplingInterval: 100, discardOldest: false, queueSize: 10000, filter };


                    const monitoredItem = await subscription.monitor(
                        itemToMonitor,
                        parameters,
                        TimestampsToReturn.Both
                    );
                    monitoredItem.on("changed", () => { nbChanges++; });
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
