import "should";
import { assert } from "node-opcua-assert";
import {
    OPCUAClient,
    AttributeIds,
    resolveNodeId,
    ClientMonitoredItem,
    ClientMonitoredItemGroup,
    TimestampsToReturn
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server: any;[k: string]: any }

const doDebug = false;

/**
 * ClientMonitoredItem & ClientMonitoredItemGroup tests (converted from callback JS to async/await TS)
 *
 * Original test IDs preserved (AA11..AA16) + issue reference #534 for invalid nodes in a group.
 * Behavior summary:
 *  - AA11: single monitored item produces value changes then terminates after 10 notifications.
 *  - AA12: group of 2 items initializes; length asserted; terminate.
 *  - AA13: group of 2 items; terminate after 10 aggregated change notifications.
 *  - AA14: same as AA12 but demonstrates toString.
 *  - AA15: explicit toString call path.
 *  - AA16 (#534): group with invalid nodes still initializes; group length asserted (all attempted items retained) then terminates.
 */
export function t(test: TestHarness) {
    describe("Testing ClientMonitoredItemGroup", () => {
        let client: OPCUAClient; let endpointUrl: string;

        beforeEach(async () => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });

        afterEach(async () => {
            // client disconnected by helpers; just release reference
            // @ts-ignore
            client = null;
        });

        const waitEvent = <T = any>(emitter: any, event: string) => new Promise<T>((resolve) => emitter.once(event, resolve));
        const terminatePromise = (obj: { terminate: (cb: (err?: Error) => void) => void }) => new Promise<void>((res, rej) => obj.terminate((e) => e ? rej(e) : res()));

        it("AA11 creates a ClientMonitoredItem and gets notified", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemToMonitor = { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }; // ServerStatus.CurrentTime
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, options, TimestampsToReturn.Both);
                let count = 0;
                await waitEvent(monitoredItem, "initialized");
                await new Promise<void>((resolve, reject) => {
                    monitoredItem.on("changed", async () => {
                        count++;
                        if (count === 10) {
                            try { await terminatePromise(monitoredItem); resolve(); } catch (e) { reject(e); }
                        }
                    });
                });
            });
        });

        it("AA12 creates a ClientMonitoredItemGroup", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options, TimestampsToReturn.Both);
                await waitEvent(group, "initialized");
                group.monitoredItems.length.should.eql(2);
                await terminatePromise(group);
            });
        });

        it("AA13 creates a ClientMonitoredItemGroup and receives changes", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options, TimestampsToReturn.Both);
                await waitEvent(group, "initialized");
                group.monitoredItems.length.should.eql(2);
                let count = 0;
                await new Promise<void>((resolve, reject) => {
                    group.on("changed", async () => {
                        count++;
                        if (count === 10) {
                            try { await terminatePromise(group); resolve(); } catch (e) { reject(e); }
                        }
                    });
                });
            });
        });

        it("AA14 creates a ClientMonitoredItemGroup and calls toString", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options, TimestampsToReturn.Both);
                await waitEvent(group, "initialized");
                if (doDebug) console.log(group.toString());
                group.monitoredItems.length.should.eql(2);
                await terminatePromise(group);
            });
        });

        it("AA15 calls toString on ClientMonitoredItemGroup", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options, TimestampsToReturn.Both);
                await waitEvent(group, "initialized");
                if (doDebug) console.log("monitoredItemGroup =", group.toString());
                await terminatePromise(group);
            });
        });


        it("AA11-B creates a ClientMonitoredItemGroup with one item and gets notified", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [{ nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }]; // ServerStatus.CurrentTime
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);
                group.monitoredItems.length.should.eql(1);
                let count = 0;
                await new Promise<void>((resolve, reject) => {
                    group.on("changed", async (monitoredItem: ClientMonitoredItem, dataValue: any, index: number) => {
                        count++;
                        if (count === 10) {
                            try { await group.terminate(); resolve(); } catch (e) { reject(e); }
                        }
                    });
                });
            });
        });

        it("AA12-B creates a ClientMonitoredItemGroup", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);
                group.monitoredItems.length.should.eql(2);
                await group.terminate();
            });
        });

        it("AA13-B creates a ClientMonitoredItemGroup and receives changes", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);
                group.monitoredItems.length.should.eql(2);
                let count = 0;
                await new Promise<void>((resolve, reject) => {
                    group.on("changed", async () => {
                        count++;
                        if (count === 10) {
                            try { await group.terminate(); resolve(); } catch (e) { reject(e); }
                        }
                    });
                });
            });
        });

        it("AA14-B creates a ClientMonitoredItemGroup and calls toString", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);
                if (doDebug) console.log(group.toString());
                group.monitoredItems.length.should.eql(2);
                await group.terminate();
            });
        });

        it("AA15-B calls toString on ClientMonitoredItemGroup", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value }
                ];
                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };
                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);
                if (doDebug) console.log("monitoredItemGroup =", group.toString());
                await group.terminate();
            });
        });
        it("AA16-B creates group with invalid nodes (#534) - using official API ", async () => {
            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                const itemsToMonitor = [
                    { nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value },
                    { nodeId: resolveNodeId("ns=0;i=88"), attributeId: AttributeIds.Value }, // invalid RootFolder as Object
                    { nodeId: resolveNodeId("ns=0;i=11492"), attributeId: AttributeIds.Value } // GetMonitoredItem is Method
                ];

                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };

                const group = await subscription.monitorItems(itemsToMonitor, options, TimestampsToReturn.Both);

                group.monitoredItems.length.should.eql(3);

                await group.terminate();
            });
        });
    });

}
