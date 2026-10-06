import { type CompactAddressSpace, SessionContext } from "node-opcua-address-space";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import {
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType,
    MonitoredItemCreateRequest,
    MonitoringMode
} from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import type { MonitoredItem } from "../dist/monitored_item.js";
import { prepareMonitoredItem } from "../dist/opcua_server.js";
import { ServerEngine } from "../dist/server_engine.js";
import type { ServerSession } from "../dist/server_session.js";
import type { Subscription } from "../dist/server_subscription.js";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type CompactVariable = ReturnType<CompactAddressSpace["addVariable"]>;

describe("ServerEngine with a compact address space: monitored items on compact nodes", function () {
    this.timeout(60000);
    let engine: ServerEngine;
    let compact: CompactAddressSpace;
    let ns: number;
    let session: ServerSession;
    let subscription: Subscription;
    let speed: CompactVariable;
    let onChange: CompactVariable;

    before((done) => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact:sub" });
        engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, () => {
            compact = engine.compactAddressSpace as CompactAddressSpace;
            ns = engine.registerCompactNamespace("urn:test:compact:plant");
            const plant = compact.addFolder(compact.findNode("ns=0;i=85") as never, "Plant");
            speed = compact.addVariable({
                nodeId: `ns=${ns};s=Speed`,
                browseName: "Speed",
                organizedBy: plant,
                dataType: "Double",
                minimumSamplingInterval: 50,
                value: { dataType: DataType.Double, value: 1 }
            });
            onChange = compact.addVariable({
                nodeId: `ns=${ns};s=OnChange`,
                browseName: "OnChange",
                organizedBy: plant,
                dataType: "Int32",
                minimumSamplingInterval: 0,
                value: { dataType: DataType.Int32, value: 0 }
            });
            session = engine.createSession();
            subscription = session.createSubscription({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 100,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 0
            });
            subscription.on("monitoredItem", (monitoredItem: MonitoredItem) =>
                prepareMonitoredItem(session.sessionContext, engine.nodeFinder, monitoredItem)
            );
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    const monitor = async (nodeId: string, samplingInterval: number, filter?: DataChangeFilter) => {
        const request = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
            monitoringMode: MonitoringMode.Reporting,
            requestedParameters: { clientHandle: 1, samplingInterval, queueSize: 10, discardOldest: true, filter }
        });
        const result = await subscription.createMonitoredItem(engine.nodeFinder, TimestampsToReturn.Both, request);
        return { result, monitoredItem: subscription.getMonitoredItem(result.monitoredItemId) };
    };

    it("samples a compact Variable and queues its changes", async () => {
        const { result, monitoredItem } = await monitor(`ns=${ns};s=Speed`, 50);
        should(result.statusCode).eql(StatusCodes.Good);
        should(result.revisedSamplingInterval).eql(50);
        should(monitoredItem?.node?.nodeClass).eql(NodeClass.Variable);
        await pause(150);
        const initial = monitoredItem?.queue.length ?? 0;
        should(initial).be.aboveOrEqual(1, "the initial value");
        speed.setValueFromSource(new Variant({ dataType: DataType.Double, value: 2 }));
        await pause(150);
        should(monitoredItem?.queue.length).be.above(initial);
        const last = monitoredItem?.queue[monitoredItem.queue.length - 1];
        should((last as { value: { value: { value: number } } }).value.value.value).eql(2);
        await pause(150);
        should(monitoredItem?.queue.length).eql(initial + 1, "an unchanged value is not queued again");
    });

    it("delivers a change-based item on each write, through the view the writer reaches", async () => {
        const { result, monitoredItem } = await monitor(`ns=${ns};s=OnChange`, 0);
        should(result.statusCode).eql(StatusCodes.Good);
        should(monitoredItem?.isExceptionBased).eql(true);
        // the initial value lands first
        await pause((result.revisedSamplingInterval || 0) + 50);
        const before = monitoredItem?.queue.length ?? 0;
        should(before).be.aboveOrEqual(1);
        // written through another path than the view the item holds: the engine's Write service
        const { WriteValue } = await import("node-opcua-service-write");
        const { DataValue } = await import("node-opcua-data-value");
        const statuses = await engine.write(SessionContext.defaultContext, [
            new WriteValue({
                nodeId: `ns=${ns};s=OnChange`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value: 7 }) })
            })
        ]);
        should(statuses[0]).eql(StatusCodes.Good);
        // the revised sampling interval is the coalescing window of a change-based item
        await pause((result.revisedSamplingInterval || 0) + 50);
        should(monitoredItem?.queue.length).eql(before + 1, "no sampling timer: the write itself notified the item");
        onChange.setValueFromSource(new Variant({ dataType: DataType.Int32, value: 8 }));
        await pause((result.revisedSamplingInterval || 0) + 50);
        should(monitoredItem?.queue.length).eql(before + 2);
    });

    it("keeps the monitored view as the node's view while the ring churns", () => {
        for (let i = 0; i < 30000; i++) compact.viewOf(i % compact.nodeCount);
        should(compact.findNode(`ns=${ns};s=OnChange`)).equal(onChange, "the view with listeners stays");
    });

    it("accepts a deadband filter on a numeric compact Variable and refuses it on a string", async () => {
        const text = compact.addVariable({
            nodeId: `ns=${ns};s=Text`,
            browseName: "Text",
            organizedBy: compact.findNode(`ns=${ns};i=1000`) as never,
            dataType: "String"
        });
        should(text.nodeClass).eql(NodeClass.Variable);
        const filter = new DataChangeFilter({
            trigger: DataChangeTrigger.StatusValue,
            deadbandType: DeadbandType.Absolute,
            deadbandValue: 0.5
        });
        should((await monitor(`ns=${ns};s=Speed`, 100, filter)).result.statusCode).eql(StatusCodes.Good);
        should((await monitor(`ns=${ns};s=Text`, 100, filter)).result.statusCode).eql(StatusCodes.BadFilterNotAllowed);
    });

    it("answers BadNodeIdUnknown for a node that is in neither space", async () => {
        should((await monitor(`ns=${ns};s=Nope`, 100)).result.statusCode).eql(StatusCodes.BadNodeIdUnknown);
    });

    it("tells the item when its node is deleted", async () => {
        const doomed = compact.addVariable({
            nodeId: `ns=${ns};s=Doomed`,
            browseName: "Doomed",
            organizedBy: compact.findNode(`ns=${ns};i=1000`) as never,
            dataType: "Double"
        });
        const { monitoredItem } = await monitor(`ns=${ns};s=Doomed`, 50);
        let disposed = false;
        doomed.on("dispose", () => {
            disposed = true;
        });
        compact.deleteNode(doomed);
        should(disposed).eql(true);
        should(monitoredItem?.isSampling).eql(false, "the item stopped sampling");
        const last = monitoredItem?.queue[monitoredItem.queue.length - 1] as { value: { statusCode: unknown } } | undefined;
        should(last?.value.statusCode).eql(StatusCodes.BadNodeIdInvalid, "the client is told the node is gone");
    });
});
