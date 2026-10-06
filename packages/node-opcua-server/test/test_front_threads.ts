import {
    ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    type MonitoringParametersOptions,
    OPCUAClient,
    type ReadValueIdOptions,
    TimestampsToReturn
} from "node-opcua-client";
import { AttributeIds, BrowseDirection, NodeClass, ResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5826;

async function until(predicate: () => boolean, what: string, timeout = 5000): Promise<void> {
    const end = Date.now() + timeout;
    while (!predicate()) {
        if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

/** the values an item reports, in order */
async function monitor(
    subscription: ClientSubscription,
    item: ReadValueIdOptions,
    parameters: MonitoringParametersOptions
): Promise<{ item: ClientMonitoredItem; values: DataValue[] }> {
    const values: DataValue[] = [];
    const monitored = ClientMonitoredItem.create(subscription, item, parameters, TimestampsToReturn.Both);
    monitored.on("changed", (dataValue: DataValue) => values.push(dataValue));
    await new Promise<void>((resolve, reject) => {
        monitored.once("initialized", () => resolve());
        monitored.once("err", (message: string) => reject(new Error(message)));
    });
    return { item: monitored, values };
}

async function write(session: ClientSession, nodeId: string, value: Variant): Promise<void> {
    const status = await session.write({ nodeId, attributeId: AttributeIds.Value, value: new DataValue({ value }) });
    should(status).eql(StatusCodes.Good);
}

describe("FrontThreadEngine: an engine thread and front threads on one port", function () {
    this.timeout(120000);
    let engine: FrontThreadEngine;
    let ns: number;
    const clients: OPCUAClient[] = [];
    const sessions: ClientSession[] = [];
    let getterCalls = 0;

    before(async () => {
        engine = await FrontThreadEngine.create();
        ns = engine.registerNamespace("urn:test:front-threads");
        const space = engine.addressSpace;
        const plant = space.addFolder(space.findNode("ns=0;i=85") as never, "Plant");
        space.addVariable({
            nodeId: `ns=${ns};s=Speed`,
            browseName: "Speed",
            componentOf: plant,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1.5 }
        });
        space.addVariable({
            nodeId: `ns=${ns};s=Name`,
            browseName: "Name",
            componentOf: plant,
            dataType: "String",
            value: { dataType: DataType.String, value: "pump" }
        });
        space.addVariable({
            nodeId: `ns=${ns};s=WriteOnly`,
            browseName: "WriteOnly",
            componentOf: plant,
            dataType: "Double",
            accessLevel: 2
        });
        space.addVariable({
            nodeId: `ns=${ns};s=Counter`,
            browseName: "Counter",
            componentOf: plant,
            dataType: "UInt32",
            value: { get: () => new Variant({ dataType: DataType.UInt32, value: ++getterCalls }) }
        });
        await engine.start({
            fronts: 2,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port }
        });
        // several connections: the kernel spreads them over the fronts
        for (let k = 0; k < 4; k++) {
            const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
            // one port on Linux, one per front elsewhere: the clients go round the endpoints
            const url = new URL(engine.endpointUrls[k % engine.endpointUrls.length]);
            await client.connect(`opc.tcp://localhost:${url.port}`);
            clients.push(client);
            sessions.push(await client.createSession());
        }
    });
    after(async () => {
        for (const session of sessions) await session.close();
        for (const client of clients) await client.disconnect();
        await engine.shutdown();
    });

    it("starts the fronts on the same port", () => {
        should(engine.frontCount).eql(2);
        should(engine.endpointUrls.length).eql(2);
    });

    it("answers a scalar under no permission rule without asking the engine", async () => {
        const before = engine.requests.read;
        for (const session of sessions) {
            const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
            should(value.statusCode).eql(StatusCodes.Good);
        }
        should(engine.requests.read).eql(before);
    });

    it("reads a value in place and the others through the engine", async () => {
        const values = await sessions[0].read([
            { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
            { nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value },
            { nodeId: `ns=${ns};s=WriteOnly`, attributeId: AttributeIds.Value },
            { nodeId: `ns=${ns};s=Counter`, attributeId: AttributeIds.Value },
            { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.BrowseName },
            { nodeId: `ns=${ns};s=Nope`, attributeId: AttributeIds.Value },
            { nodeId: "ns=0;i=2256", attributeId: AttributeIds.BrowseName }
        ]);
        should(values[0].statusCode).eql(StatusCodes.Good);
        should(values[0].value.value).eql(1.5, "in place: a scalar under no permission rule");
        should(values[1].value.value).eql("pump", "a string: the engine answers it");
        should(values[2].statusCode).eql(StatusCodes.BadNotReadable);
        should(values[3].value.value).be.above(0, "a getter: called in the engine");
        should(values[4].value.value.name).eql("Speed");
        should(values[5].statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(values[6].value.value.name).eql("ServerStatus", "the base namespace from the front's own nodes");
    });

    it("writes through the engine and every connection sees it", async () => {
        const statuses = await sessions[1].write([
            {
                nodeId: `ns=${ns};s=Speed`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: 42 }) })
            },
            {
                nodeId: `ns=${ns};s=Speed`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.String, value: "x" }) })
            }
        ]);
        should(statuses).eql([StatusCodes.Good, StatusCodes.BadTypeMismatch]);
        for (const session of sessions) {
            const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
            should(value.value.value).eql(42);
        }
    });

    it("browses from the Objects folder into the compact namespace and translates a path", async () => {
        const objects = await sessions[2].browse({
            nodeId: "ns=0;i=85",
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "ns=0;i=33",
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: ResultMask.BrowseName | ResultMask.NodeClass
        });
        const plant = (objects.references ?? []).find((r) => r.browseName.name === "Plant");
        should(plant?.nodeClass).eql(NodeClass.Object);
        should(objects.references?.filter((r) => r.browseName.name === "Server").length).eql(1);
        const children = await sessions[2].browse({
            nodeId: plant?.nodeId.toString() ?? "",
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "ns=0;i=47",
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: ResultMask.BrowseName
        });
        should((children.references ?? []).map((r) => r.browseName.name).sort()).eql(["Counter", "Name", "Speed", "WriteOnly"]);
        const translated = await sessions[3].translateBrowsePath(makeBrowsePath("ns=0;i=85", `/${ns}:Plant/${ns}:Speed`));
        should(translated.statusCode).eql(StatusCodes.Good);
        should(translated.targets?.[0].targetId.toString()).eql(`ns=${ns};s=Speed`);
    });

    it("serves the nodes added after the fronts started, the columns grown meanwhile", async () => {
        const space = engine.addressSpace;
        const plant = space.findNode(`ns=${ns};s=Speed`)?.parent as never;
        for (let k = 0; k < 20000; k++) {
            space.addVariable({
                nodeId: `ns=${ns};i=${100000 + k}`,
                browseName: `V${k}`,
                componentOf: plant,
                dataType: "Int32",
                value: { dataType: DataType.Int32, value: k }
            });
        }
        // the fronts get the new buffers on the next turn of the engine's loop
        await new Promise((resolve) => setTimeout(resolve, 100));
        for (const session of sessions) {
            const values = await session.read([
                { nodeId: `ns=${ns};i=${100000 + 19999}`, attributeId: AttributeIds.Value },
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value }
            ]);
            should(values[0].value.value).eql(19999);
            should(values[1].value.value).eql(42);
        }
    });

    describe("monitored items on the compact namespace", () => {
        const subscriptions: ClientSubscription[] = [];
        before(async () => {
            for (const session of sessions) {
                subscriptions.push(
                    await session.createSubscription2({
                        requestedPublishingInterval: 20,
                        requestedMaxKeepAliveCount: 10,
                        requestedLifetimeCount: 100,
                        publishingEnabled: true
                    })
                );
            }
        });
        after(async () => {
            for (const subscription of subscriptions) await subscription.terminate();
        });

        it("samples a value in place and reports what another connection writes", async () => {
            const describes = engine.requests.describe;
            const reads = engine.requests.value;
            const { item, values } = await monitor(
                subscriptions[0],
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
                { samplingInterval: 20, queueSize: 10, discardOldest: true }
            );
            await until(() => values.length >= 1, "the initial value");
            should(values[0].value.value).eql(42);
            await write(sessions[1], `ns=${ns};s=Speed`, new Variant({ dataType: DataType.Double, value: 7 }));
            await until(() => values.some((v) => v.value.value === 7), "the written value");
            should(engine.requests.describe).eql(describes + 1, "the node described once, when the item is created");
            should(engine.requests.value).eql(reads, "sampled in place: no value asked to the engine");
            await item.terminate();
            await write(sessions[1], `ns=${ns};s=Speed`, new Variant({ dataType: DataType.Double, value: 42 }));
        });

        it("reports every value written to a node, in order, when the item listens to changes", async () => {
            const { item, values } = await monitor(
                subscriptions[0],
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 100, discardOldest: true }
            );
            await until(() => values.length >= 1, "the initial value");
            for (let k = 1; k <= 20; k++) {
                await write(sessions[1 + (k % 3)], `ns=${ns};s=Speed`, new Variant({ dataType: DataType.Double, value: k }));
            }
            await until(() => values.some((v) => v.value.value === 20), "the last value");
            const seen = values.slice(1).map((v) => v.value.value as number);
            should(seen).eql(
                [...seen].sort((a, b) => a - b),
                "never back to an older value"
            );
            should(seen).eql(
                Array.from({ length: 20 }, (_, k) => k + 1),
                "one notification per write"
            );
            await item.terminate();
        });

        it("reports the changes of a value the front cannot read in place", async () => {
            const { item, values } = await monitor(
                subscriptions[1],
                { nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 10, discardOldest: true }
            );
            await until(() => values.length >= 1, "the initial value");
            should(values[0].value.value).eql("pump");
            await write(sessions[2], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: "valve" }));
            await until(() => values.some((v) => v.value.value === "valve"), "the written string");
            await item.terminate();
        });

        it("monitors an attribute other than the Value", async () => {
            const { item, values } = await monitor(
                subscriptions[2],
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.BrowseName },
                { samplingInterval: 100, queueSize: 1, discardOldest: true }
            );
            await until(() => values.length >= 1, "the attribute");
            should(values[0].value.value.name).eql("Speed");
            await item.terminate();
        });

        it("refuses an item on a node that does not exist", async () => {
            await should(
                monitor(
                    subscriptions[3],
                    { nodeId: `ns=${ns};s=Nope`, attributeId: AttributeIds.Value },
                    { samplingInterval: 100, queueSize: 1, discardOldest: true }
                )
            ).be.rejectedWith(/BadNodeIdUnknown/);
        });

        it("tells the items of a deleted node", async () => {
            const space = engine.addressSpace;
            const plant = space.findNode(`ns=${ns};s=Speed`)?.parent as never;
            space.addVariable({
                nodeId: `ns=${ns};s=Doomed`,
                browseName: "Doomed",
                componentOf: plant,
                dataType: "Double",
                value: { dataType: DataType.Double, value: 3 }
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
            const changes = await monitor(
                subscriptions[0],
                { nodeId: `ns=${ns};s=Doomed`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 10, discardOldest: true }
            );
            const sampled = await monitor(
                subscriptions[1],
                { nodeId: `ns=${ns};s=Doomed`, attributeId: AttributeIds.Value },
                { samplingInterval: 20, queueSize: 10, discardOldest: true }
            );
            await until(() => changes.values.length >= 1 && sampled.values.length >= 1, "the initial values");
            space.deleteNode(`ns=${ns};s=Doomed`);
            await until(() => changes.values.some((v) => !v.statusCode.isGood()), "the item listening to changes told");
            await until(() => sampled.values.some((v) => !v.statusCode.isGood()), "the sampled item told");
            await changes.item.terminate();
            await sampled.item.terminate();
        });
    });
});
