import { AddressSpace, SessionContext, type UAVariable } from "node-opcua-address-space";
import { create_minimalist_address_space_nodeset } from "node-opcua-address-space/testHelpers.js";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import type { PreciseClock } from "node-opcua-date-time";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import type { MonitoredItemNotification } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { MonitoredItem, type MonitoredItemOptions } from "../source/index.js";

// the sampler stamps the values it obtains with one clock read per group of items, made once they have answered
const busyWait = (ms: number) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
        /* the refreshFunc takes this long */
    }
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("sampled values of variables with a refreshFunc: server timestamps", () => {
    let addressSpace: AddressSpace;
    const items: MonitoredItem[] = [];
    before(() => {
        addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);
        addressSpace.registerNamespace("Private");
    });
    afterEach(() => {
        for (const item of items.splice(0)) {
            item.terminate();
            item.dispose();
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    // a refreshFunc that takes 2 ms and stamps its value with the time it made it, like a device driver (or the o6
    // benchmark's counters); `serverTimestamp` when it sets one itself
    function addCounter(name: string, serverTimestamp?: Date): UAVariable {
        let count = 0;
        return addressSpace.getOwnNamespace().addVariable({
            browseName: name,
            dataType: "Double",
            minimumSamplingInterval: 1,
            value: {
                refreshFunc(callback) {
                    busyWait(2);
                    count++;
                    callback(
                        null,
                        new DataValue({
                            sourceTimestamp: new Date(),
                            serverTimestamp,
                            value: { dataType: DataType.Double, value: count }
                        })
                    );
                }
            }
        });
    }

    // sampled as the server samples a Value attribute of a variable with readValueAsync
    function monitor(variable: UAVariable, monitoredItemId: number): MonitoredItem {
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            monitoredItemId,
            samplingInterval: 50,
            discardOldest: true,
            queueSize: 1,
            timestampsToReturn: TimestampsToReturn.Both,
            itemToMonitor: { nodeId: variable.nodeId, attributeId: AttributeIds.Value }
        } as unknown as MonitoredItemOptions);
        (monitoredItem as unknown as { $subscription: unknown }).$subscription = {
            $session: { sessionContext: SessionContext.defaultContext }
        };
        monitoredItem.setNode(variable);
        monitoredItem.samplingFunc = (context, _oldValue, callback, clock?: PreciseClock) => {
            variable.readValueAsync(context, callback, clock);
        };
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        items.push(monitoredItem);
        return monitoredItem;
    }
    const latest = (monitoredItem: MonitoredItem) => (monitoredItem.queue[0] as MonitoredItemNotification).value;

    it("never stamps a sampled value earlier than the source timestamp its refreshFunc took", async () => {
        // three items sampled together: the last one answers 6 ms after the sampling began
        const monitoredItems = [1, 2, 3].map((i) => monitor(addCounter(`Counter${i}`), i));
        await pause(140);
        for (const monitoredItem of monitoredItems) {
            const dataValue = latest(monitoredItem);
            should(dataValue.value.value).be.above(1, "a sampled value, not the initial one");
            const source = (dataValue.sourceTimestamp as Date).getTime();
            const server = (dataValue.serverTimestamp as Date).getTime();
            should(server).be.aboveOrEqual(source);
            // read once the items sampled together had answered: a few ms later at most
            should(server - source).be.belowOrEqual(20);
        }
    });

    it("keeps the server timestamp a refreshFunc sets itself", async () => {
        const own = new Date(Date.UTC(2026, 0, 1));
        const monitoredItem = monitor(addCounter("CounterWithServerTimestamp", own), 4);
        await pause(140);
        const dataValue = latest(monitoredItem);
        should(dataValue.value.value).be.above(1, "a sampled value, not the initial one");
        should((dataValue.serverTimestamp as Date).getTime()).eql(own.getTime());
    });
});
