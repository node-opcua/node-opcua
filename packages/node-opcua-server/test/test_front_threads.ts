import {
    ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    type MonitoringParametersOptions,
    OPCUAClient,
    type ReadValueIdOptions,
    TimestampsToReturn
} from "node-opcua-client";
import { AttributeIds, BrowseDirection, NodeClass, QualifiedName, ResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataChangeFilter, DataChangeTrigger, DeadbandType } from "node-opcua-service-subscription";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType, Range } from "node-opcua-types";
import { DataType, Variant, VariantArrayType, type VariantLike } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5826;
// the engine started with the default number of fronts
const defaultFrontsPort = 5828;

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

/** a value set by the application, in the engine */
function setFromSource(engine: FrontThreadEngine, nodeId: string, value: VariantLike): void {
    (engine.addressSpace.findNode(nodeId) as unknown as { setValueFromSource(value: VariantLike): void }).setValueFromSource(value);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** the scalar types a front encodes straight from the store, with a value of each */
const SCALARS: [string, number | boolean][] = [
    ["Boolean", true],
    ["SByte", -5],
    ["Byte", 200],
    ["Int16", -300],
    ["UInt16", 60000],
    ["Int32", -70000],
    ["UInt32", 4000000000],
    ["Float", 1.5],
    ["Double", 2.25]
];

const BIG_ELEMENTS = 1024 * 1024;
/** an Int32 array whose elements say which one it is: element i is seed + i */
function bigArray(seed: number): Int32Array {
    const array = new Int32Array(BIG_ELEMENTS);
    for (let i = 0; i < BIG_ELEMENTS; i++) array[i] = seed + i;
    return array;
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
        // items that report changes as they happen, without a coalescing window: a setting of the one server
        engine = await FrontThreadEngine.create({ serverCapabilities: { minSupportedSampleRate: 0 } });
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
        // the bulk nodes live in a folder of their own: the Plant folder's children are checked below
        const bulk = space.addFolder(space.findNode("ns=0;i=85") as never, "Bulk");
        space.addVariable({
            nodeId: `ns=${ns};s=Batch`,
            browseName: "Batch",
            componentOf: bulk,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 0 }
        });
        space.addVariable({
            nodeId: `ns=${ns};s=Big`,
            browseName: "Big",
            componentOf: bulk,
            dataType: "Int32",
            valueRank: 1,
            accessLevel: 3,
            userAccessLevel: 3,
            // 4 MB: above the size from which the engine hands buffers over instead of copying them
            value: new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: bigArray(0) })
        });
        space.addVariable({
            nodeId: `ns=${ns};s=Levels`,
            browseName: "Levels",
            componentOf: plant,
            dataType: "Int32",
            valueRank: 1,
            value: { dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([3, 1, 4]) }
        });
        // one Variable of each type a front encodes itself when it reads it in place
        for (const [type, value] of SCALARS) {
            space.addVariable({
                nodeId: `ns=${ns};s=Type${type}`,
                browseName: `Type${type}`,
                componentOf: bulk,
                dataType: type,
                value: { dataType: DataType[type as keyof typeof DataType] as DataType, value }
            });
        }
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
        const before = engine.serviceRequests.read;
        for (const session of sessions) {
            const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
            should(value.statusCode).eql(StatusCodes.Good);
        }
        should(engine.serviceRequests.read).eql(before);
    });

    it("reads a scalar of each type in place as the engine has it, timestamps and status included", async () => {
        setFromSource(engine, `ns=${ns};s=TypeInt16`, { dataType: DataType.Int16, value: -300 });
        const uncertain = engine.addressSpace.findNode(`ns=${ns};s=TypeUInt16`) as unknown as {
            setValueFromSource(value: VariantLike, statusCode: typeof StatusCodes.UncertainInitialValue): void;
        };
        uncertain.setValueFromSource({ dataType: DataType.UInt16, value: 60000 }, StatusCodes.UncertainInitialValue);
        const before = engine.serviceRequests.read;
        const values = await sessions[0].read(
            SCALARS.map(([type]) => ({ nodeId: `ns=${ns};s=Type${type}`, attributeId: AttributeIds.Value })),
            0
        );
        should(engine.serviceRequests.read).eql(before);
        SCALARS.forEach(([type, value], k) => {
            const dataValue = values[k];
            const inEngine = (
                engine.addressSpace.findNode(`ns=${ns};s=Type${type}`) as unknown as { readValue(): DataValue }
            ).readValue();
            should(dataValue.value.dataType).eql(DataType[type as keyof typeof DataType], type);
            should(dataValue.value.value).eql(value, type);
            should(dataValue.statusCode).eql(inEngine.statusCode, type);
            should(dataValue.sourceTimestamp?.getTime()).eql(inEngine.sourceTimestamp?.getTime(), type);
            should(dataValue.sourcePicoseconds).eql(inEngine.sourcePicoseconds, type);
            should(dataValue.serverTimestamp).not.eql(null, type);
        });
        should(values[4].statusCode).eql(StatusCodes.UncertainInitialValue);
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
        should(values[1].value.value).eql("pump", "a string: in place too, from the shared heap");
        should(values[2].statusCode).eql(StatusCodes.BadNotReadable);
        should(values[3].value.value).be.above(0, "a getter: called in the engine");
        should(values[4].value.value.name).eql("Speed");
        should(values[5].statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(values[6].value.value.name).eql("ServerStatus", "the base namespace from the front's own nodes");
    });

    it("serves strings and arrays in place, before and after a write", async () => {
        const before = engine.serviceRequests.read;
        for (const session of sessions) {
            const [name, levels] = await session.read([
                { nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value },
                { nodeId: `ns=${ns};s=Levels`, attributeId: AttributeIds.Value }
            ]);
            should(name.value.value).eql("pump");
            should([...(levels.value.value as Int32Array)]).eql([3, 1, 4]);
        }
        // a longer string: a new slot in the heap
        await write(sessions[1], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: "centrifugal pump" }));
        for (const session of sessions) {
            const name = await session.read({ nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value });
            should(name.value.value).eql("centrifugal pump");
        }
        should(engine.serviceRequests.read).eql(before, "no read asked to the engine");
        await write(sessions[1], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: "pump" }));
    });

    it("calls a Method of the compact namespace: the engine runs it", async () => {
        const space = engine.addressSpace;
        const plant = space.findNode(`ns=${ns};s=Speed`)?.parent;
        should(plant).not.eql(null);
        const reset = space.addMethod({
            nodeId: `ns=${ns};s=Plant.Reset`,
            browseName: "Reset",
            componentOf: plant ?? undefined,
            inputArguments: [{ name: "speed", dataType: resolveNodeId("Double"), valueRank: -1 }],
            outputArguments: [{ name: "previous", dataType: resolveNodeId("Double"), valueRank: -1 }]
        });
        reset.bindMethod((inputs) => {
            const speed = space.findNode(`ns=${ns};s=Speed`) as unknown as {
                readValue(): DataValue;
                setValueFromSource(v: VariantLike): void;
            };
            const previous = speed.readValue().value.value as number;
            speed.setValueFromSource({ dataType: DataType.Double, value: inputs[0].value as number });
            return { outputArguments: [{ dataType: DataType.Double, value: previous }] };
        });
        await pause(50);
        const before = engine.serviceRequests.call;
        const result = await sessions[0].call({
            objectId: plant?.nodeId ?? "",
            methodId: reset.nodeId,
            inputArguments: [new Variant({ dataType: DataType.Double, value: 12 })]
        });
        should(result.statusCode).eql(StatusCodes.Good);
        should(result.outputArguments?.[0].value).eql(1.5);
        should(engine.serviceRequests.call).eql(before + 1);
        for (const session of sessions) {
            const speed = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
            should(speed.value.value).eql(12);
        }
        const wrong = await sessions[1].call({
            objectId: plant?.nodeId ?? "",
            methodId: reset.nodeId,
            inputArguments: [new Variant({ dataType: DataType.String, value: "fast" })]
        });
        should(wrong.statusCode).eql(StatusCodes.BadInvalidArgument);
        await write(sessions[1], `ns=${ns};s=Speed`, new Variant({ dataType: DataType.Double, value: 1.5 }));
    });

    it("reads the history of a compact Variable through a front, with continuation points", async () => {
        const space = engine.addressSpace;
        const plant = space.findNode(`ns=${ns};s=Speed`)?.parent;
        const flow = space.addVariable({
            nodeId: `ns=${ns};s=Flow`,
            browseName: "Flow",
            organizedBy: plant ?? undefined,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 0 }
        });
        space.installHistoricalDataNode(flow);
        const start = new Date(Date.now() - 1000);
        for (let k = 1; k <= 5; k++) {
            flow.setValueFromSource({ dataType: DataType.Double, value: k }, StatusCodes.Good, new Date(Date.now() + k));
        }
        await pause(50);
        const end = new Date(Date.now() + 10000);
        const before = engine.serviceRequests.historyRead;
        // two values at a time: the continuation point lives in the front's session
        const seen: number[] = [];
        let first = await sessions[0].readHistoryValue(flow.nodeId, start, end, { numValuesPerNode: 2, returnBounds: false });
        should(first.statusCode.isGood()).eql(true);
        for (;;) {
            for (const d of (first.historyData as { dataValues?: DataValue[] }).dataValues ?? [])
                seen.push(d.value.value as number);
            if (!first.continuationPoint || first.continuationPoint.length === 0) break;
            first = await sessions[0].readHistoryValue(
                { nodeId: flow.nodeId, continuationPoint: first.continuationPoint },
                start,
                end,
                {
                    numValuesPerNode: 2,
                    returnBounds: false
                }
            );
        }
        // the values written once the Variable was historized, in two-value pages
        should(seen).eql([1, 2, 3, 4, 5]);
        should(engine.serviceRequests.historyRead).be.above(before);
        // with the bounds: none before the first value (BoundNoData), the last value held after it
        const bounded = await sessions[0].readHistoryValue(flow.nodeId, start, end, { returnBounds: true });
        const page = (bounded.historyData as unknown as { dataValues?: DataValue[] }).dataValues ?? [];
        should(page.map((d) => d.statusCode.name)).not.containEql("BadBoundNotSupported");
        should(page.length).eql(7);
        should(page.slice(1, 6).map((d) => d.value.value)).eql([1, 2, 3, 4, 5]);
        const none = await sessions[1].readHistoryValue(`ns=${ns};s=Speed`, start, end);
        should(none.statusCode).eql(StatusCodes.BadNotReadable);
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

    it("writes a number or a string in place, without the engine, and every connection reads it at once", async () => {
        const before = engine.serviceRequests.write;
        await write(sessions[2], `ns=${ns};s=Speed`, new Variant({ dataType: DataType.Double, value: 9 }));
        should(engine.serviceRequests.write).eql(before, "written by the front itself");
        for (const session of sessions) {
            const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
            should(value.value.value).eql(9);
        }
        // a string, as the bytes the client sent: in its slot of the shared heap, or a new one when longer
        for (const name of ["pomp", "a centrifugal pump with a much longer name", "pump"]) {
            await write(sessions[2], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: name }));
            for (const session of sessions) {
                const value = await session.read({ nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value });
                should(value.value.value).eql(name);
            }
        }
        should(engine.serviceRequests.write).eql(before, "the strings written by the front itself");
        // a request with one value the front does not write itself (an array): all of it goes to the engine
        const statuses = await sessions[2].write([
            {
                nodeId: `ns=${ns};s=Speed`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: 42 }) })
            },
            {
                nodeId: `ns=${ns};s=Levels`,
                attributeId: AttributeIds.Value,
                value: new DataValue({
                    value: new Variant({
                        dataType: DataType.Int32,
                        arrayType: VariantArrayType.Array,
                        value: new Int32Array([3, 1, 4])
                    })
                })
            }
        ]);
        should(statuses).eql([StatusCodes.Good, StatusCodes.Good]);
        should(engine.serviceRequests.write).eql(before + 1);
        // a refused type is still refused: the engine answers it
        const [refused] = await sessions[2].write([
            {
                nodeId: `ns=${ns};s=Speed`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Boolean, value: true }) })
            }
        ]);
        should(refused).eql(StatusCodes.BadTypeMismatch);
        const speed = await sessions[0].read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
        should(speed.value.value).eql(42);
    });

    it("reads a large array through the engine, many times at once, unchanged", async () => {
        const before = engine.serviceRequests.read;
        const values = await Promise.all(
            Array.from({ length: 8 }, (_, k) =>
                sessions[k % sessions.length].read({ nodeId: `ns=${ns};s=Big`, attributeId: AttributeIds.Value })
            )
        );
        for (const value of values) {
            should(value.statusCode).eql(StatusCodes.Good);
            should(value.value.value.length).eql(BIG_ELEMENTS);
            should(value.value.value[0]).eql(0);
            should(value.value.value[BIG_ELEMENTS - 1]).eql(BIG_ELEMENTS - 1);
        }
        should(engine.serviceRequests.read).be.above(before);
    });

    it("writes a large array through the engine and reads it back", async () => {
        await write(
            sessions[0],
            `ns=${ns};s=Big`,
            new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: bigArray(7) })
        );
        const value = await sessions[3].read({ nodeId: `ns=${ns};s=Big`, attributeId: AttributeIds.Value });
        should(value.value.value.length).eql(BIG_ELEMENTS);
        should(value.value.value[0]).eql(7);
        should(value.value.value[BIG_ELEMENTS - 1]).eql(7 + BIG_ELEMENTS - 1);
    });

    it("writes a batch of 1000 items through the engine, each with its own status, in order", async () => {
        const nodesToWrite = Array.from({ length: 1000 }, (_, k) => ({
            nodeId: k % 10 === 9 ? `ns=${ns};s=Nope` : `ns=${ns};s=Batch`,
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: k }) })
        }));
        const statuses = await sessions[2].write(nodesToWrite);
        should(statuses.length).eql(1000);
        for (let k = 0; k < 1000; k++) {
            should(statuses[k]).eql(k % 10 === 9 ? StatusCodes.BadNodeIdUnknown : StatusCodes.Good);
        }
        const value = await sessions[0].read({ nodeId: `ns=${ns};s=Batch`, attributeId: AttributeIds.Value });
        should(value.value.value).eql(998, "the last good item of the batch wins");
    });

    it("writes a node of the engine registered with RegisterNodes", async () => {
        const session = sessions[1];
        // a front registers aliases for the nodes of its own address space only: a node of the
        // engine keeps its NodeId, so the bytes the WriteValues arrived as still name it (were an
        // alias given, the server would drop those bytes and encode the resolved WriteValues)
        const [registered] = await session.registerNodes([`ns=${ns};s=Batch`]);
        should(registered.toString()).eql(`ns=${ns};s=Batch`);
        const statuses = await session.write(
            Array.from({ length: 5 }, (_, k) => ({
                nodeId: registered,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: 500 + k }) })
            }))
        );
        should(statuses).eql(Array(5).fill(StatusCodes.Good));
        const value = await sessions[0].read({ nodeId: `ns=${ns};s=Batch`, attributeId: AttributeIds.Value });
        should(value.value.value).eql(504);
        await session.unregisterNodes([registered]);
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
        should((children.references ?? []).map((r) => r.browseName.name).sort()).eql([
            "Counter",
            "Levels",
            "Name",
            "Reset",
            "Speed",
            "WriteOnly"
        ]);
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
                `one notification per write, received ${seen.join(",")}`
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

        it("reports every string written in place to a watched node, in order, without the engine writing it", async () => {
            const { item, values } = await monitor(
                subscriptions[1],
                { nodeId: `ns=${ns};s=Name`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 100, discardOldest: true }
            );
            await until(() => values.length >= 1, "the initial value");
            const before = engine.serviceRequests.write;
            // lengths that change: some in the value's slot, some in a new one
            const names = Array.from({ length: 12 }, (_, k) => `name-${k}-${"x".repeat((k * 7) % 23)}`);
            for (let k = 0; k < names.length; k++) {
                await write(sessions[1 + (k % 3)], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: names[k] }));
            }
            await until(() => values.some((v) => v.value.value === names[names.length - 1]), "the last string");
            should(engine.serviceRequests.write).eql(before, "written by the fronts themselves");
            should(values.slice(1).map((v) => v.value.value)).eql(names, "one notification per write, in order");
            await item.terminate();
            await write(sessions[1], `ns=${ns};s=Name`, new Variant({ dataType: DataType.String, value: "pump" }));
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

        it("does not hand a session the values of a node its roles may not read", async () => {
            const space = engine.addressSpace;
            const plant = space.findNode(`ns=${ns};s=Speed`)?.parent as never;
            const secret = `ns=${ns};s=Secret`;
            space.addVariable({
                nodeId: secret,
                browseName: "Secret",
                componentOf: plant,
                dataType: "Double",
                value: { dataType: DataType.Double, value: 1 },
                // read by Operators only: not by the anonymous sessions of this test
                rolePermissions: [
                    { roleId: resolveNodeId("ns=0;i=15680"), permissions: PermissionType.Browse | PermissionType.Read }
                ]
            });
            await pause(50);
            const { item, values } = await monitor(
                subscriptions[0],
                { nodeId: secret, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 10, discardOldest: true }
            );
            await until(() => values.length >= 1, "the initial answer");
            should(values[0].statusCode).eql(StatusCodes.BadUserAccessDenied);
            for (let k = 2; k <= 5; k++) {
                setFromSource(engine, secret, { dataType: DataType.Double, value: k });
                await pause(30);
            }
            await pause(300);
            should(values.filter((v) => v.statusCode.isGood()).map((v) => v.value.value)).eql(
                [],
                "no value pushed to a denied session"
            );
            await item.terminate();
        });

        it("applies a new EURange to a percent deadband", async () => {
            const space = engine.addressSpace;
            const plant = space.findNode(`ns=${ns};s=Speed`)?.parent as never;
            const level = `ns=${ns};s=Level`;
            space.addVariable({
                nodeId: level,
                browseName: "Level",
                componentOf: plant,
                dataType: "Double",
                value: { dataType: DataType.Double, value: 0 }
            });
            space.addVariable({
                nodeId: `ns=${ns};s=Level.EURange`,
                browseName: new QualifiedName({ namespaceIndex: 0, name: "EURange" }),
                propertyOf: level,
                dataType: "ns=0;i=884",
                value: { dataType: DataType.ExtensionObject, value: new Range({ low: 0, high: 100 }) }
            });
            await pause(50);
            const { item, values } = await monitor(
                subscriptions[1],
                { nodeId: level, attributeId: AttributeIds.Value },
                {
                    samplingInterval: 0,
                    queueSize: 10,
                    discardOldest: true,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.StatusValue,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            );
            await until(() => values.length >= 1, "the initial value");
            const seen = () => values.map((v) => v.value.value as number);
            await write(sessions[2], level, new Variant({ dataType: DataType.Double, value: 5 }));
            await write(sessions[2], level, new Variant({ dataType: DataType.Double, value: 20 }));
            await until(() => seen().includes(20), "a change beyond 10% of 0..100");
            should(seen()).not.containEql(5);
            setFromSource(engine, `ns=${ns};s=Level.EURange`, {
                dataType: DataType.ExtensionObject,
                value: new Range({ low: 0, high: 10 })
            });
            await pause(100);
            await write(sessions[2], level, new Variant({ dataType: DataType.Double, value: 23 }));
            await until(() => seen().includes(23), "a change beyond 10% of the new range 0..10");
            await item.terminate();
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

describe("FrontThreadEngine: the number of fronts", function () {
    this.timeout(60000);
    it("starts one front when the application does not say how many", async () => {
        const engine = await FrontThreadEngine.create();
        engine.registerNamespace("urn:test:front-threads-default");
        try {
            await engine.start({
                serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
                serverModuleData: { port: defaultFrontsPort }
            });
            should(engine.frontCount).eql(1);
            should(engine.endpointUrls.length).eql(1);
        } finally {
            await engine.shutdown();
        }
    });
});

// the port of the concurrent in-place writes below
const concurrentWritesPort = 5850;

describe("FrontThreadEngine: many connections write the same compact Variables in place while the columns grow", function () {
    this.timeout(120000);
    // a value says who wrote it, and the timestamp it was written with says the same: a read that returns
    // a value and a timestamp from two different writers is torn
    const EPOCH = Date.UTC(2026, 0, 1);
    const WRITERS_PER_FRONT = 3;
    const VARIABLES = ["Double0", "Double1", "Int32_0"];
    const RUN_MS = 5000;

    let engine: FrontThreadEngine;
    let ns: number;
    const clients: OPCUAClient[] = [];
    const sessions: ClientSession[] = [];
    /** the front of each session */
    const frontOf: number[] = [];

    const nodeId = (name: string) => `ns=${ns};s=${name}`;
    const encode = (writer: number, seq: number) => writer * 100000 + seq;
    const dataTypeOf = (name: string) => (name.startsWith("Int32") ? DataType.Int32 : DataType.Double);
    const inEngine = (name: string): DataValue =>
        (engine.addressSpace.findNode(nodeId(name)) as unknown as { readValue(): DataValue }).readValue();
    /** null when the DataValue is consistent: its timestamp is the one its value was written with */
    const tornness = (dataValue: DataValue): string | null => {
        const value = dataValue.value.value as number;
        const timestamp = dataValue.sourceTimestamp?.getTime();
        return timestamp === EPOCH + value
            ? null
            : `value ${value} with sourceTimestamp ${timestamp === undefined ? "none" : timestamp - EPOCH}`;
    };

    before(async () => {
        engine = await FrontThreadEngine.create({ serverCapabilities: { minSupportedSampleRate: 0 } });
        ns = engine.registerNamespace("urn:test:front-threads-concurrent-writes");
        const space = engine.addressSpace;
        const folder = space.addFolder(space.findNode("ns=0;i=85") as never, "Shared");
        for (const name of VARIABLES) {
            const dataType = dataTypeOf(name);
            const variable = space.addVariable({
                nodeId: nodeId(name),
                browseName: name,
                componentOf: folder,
                dataType: DataType[dataType],
                value: { dataType, value: 0 }
            });
            variable.setValueFromSource({ dataType, value: 0 }, StatusCodes.Good, new Date(EPOCH));
        }
        await engine.start({
            fronts: 2,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port: concurrentWritesPort }
        });
        // the clients go round the endpoints: one per front elsewhere than Linux, spread by the kernel there
        for (let k = 0; k < 2 * WRITERS_PER_FRONT; k++) {
            const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
            const url = new URL(engine.endpointUrls[k % engine.endpointUrls.length]);
            await client.connect(`opc.tcp://localhost:${url.port}`);
            clients.push(client);
            sessions.push(await client.createSession());
            frontOf.push(k % engine.endpointUrls.length);
        }
    });
    after(async () => {
        for (const session of sessions) await session.close();
        for (const client of clients) await client.disconnect();
        await engine.shutdown();
    });

    it("keeps a value and its timestamp together, and ends with one value everywhere", async () => {
        const space = engine.addressSpace;
        const folder = space.findNode(nodeId(VARIABLES[0]))?.parent as never;
        const writesBefore = engine.serviceRequests.write;

        // one item on Double0 behind each front
        const subscriptions: ClientSubscription[] = [];
        const monitored: { values: DataValue[]; item: ClientMonitoredItem }[] = [];
        for (const k of [0, 1]) {
            const subscription = await sessions[k].createSubscription2({
                requestedPublishingInterval: 20,
                requestedMaxKeepAliveCount: 10,
                requestedLifetimeCount: 1000,
                publishingEnabled: true
            });
            subscriptions.push(subscription);
            monitored.push(
                await monitor(
                    subscription,
                    { nodeId: nodeId("Double0"), attributeId: AttributeIds.Value },
                    { samplingInterval: 10, queueSize: 100000, discardOldest: true }
                )
            );
        }
        should(frontOf[0]).not.eql(frontOf[1], "the two items are behind two fronts");

        const violations: string[] = [];
        const badStatuses: string[] = [];
        let writes = 0;
        let reads = 0;
        let running = true;

        // a request of BATCH values, spread over the Variables: two fronts then hit the same value at the same time
        const BATCH = 100;
        const client = async (session: ClientSession, writer: number) => {
            for (let seq = 1; running && seq + BATCH < 100000; seq += BATCH) {
                const names: string[] = [];
                const nodesToWrite = [];
                for (let k = 0; k < BATCH; k++) {
                    const name = VARIABLES[(seq + k + writer) % VARIABLES.length];
                    const dataType = dataTypeOf(name);
                    const value = encode(writer, seq + k);
                    names.push(name);
                    nodesToWrite.push({
                        nodeId: nodeId(name),
                        attributeId: AttributeIds.Value,
                        value: new DataValue({ value: new Variant({ dataType, value }), sourceTimestamp: new Date(EPOCH + value) })
                    });
                }
                const statuses = await session.write(nodesToWrite);
                writes += BATCH;
                statuses.forEach((status, k) => {
                    if (status !== StatusCodes.Good) badStatuses.push(`${names[k]}: ${status.toString()}`);
                });
            }
        };

        // reads of the same Variables, BATCH times each, while the others write
        const reader = async (session: ClientSession) => {
            const nodesToRead = Array.from({ length: BATCH * VARIABLES.length }, (_, k) => ({
                nodeId: nodeId(VARIABLES[k % VARIABLES.length]),
                attributeId: AttributeIds.Value
            }));
            while (running) {
                for (const dataValue of await session.read(nodesToRead)) {
                    reads++;
                    const torn = dataValue.statusCode.isGood() ? tornness(dataValue) : `status ${dataValue.statusCode.toString()}`;
                    if (torn) violations.push(torn);
                }
            }
        };

        // the engine adds nodes meanwhile: the columns of the value store grow and move again and again
        let added = 0;
        const grow = async () => {
            while (running) {
                for (let k = 0; k < 100; k++, added++) {
                    space.addVariable({
                        nodeId: `ns=${ns};i=${200000 + added}`,
                        browseName: `G${added}`,
                        componentOf: folder,
                        dataType: "Int32",
                        value: { dataType: DataType.Int32, value: added }
                    });
                }
                await pause(25);
            }
        };

        const stop = pause(RUN_MS).then(() => {
            running = false;
        });
        await Promise.all([stop, grow(), ...sessions.map((session, k) => client(session, k + 1)), ...sessions.map(reader)]);

        should(badStatuses).eql([]);
        should(violations).eql([]);
        should(writes).be.above(50, "the clients made progress");
        should(reads).be.above(1500);
        should(added).be.above(1500, "the columns grew during the run");
        // most writes were made in place: the engine saw only those it was handed back
        should(engine.serviceRequests.write - writesBefore).be.below(writes / 2);

        // once the writers stopped: one value for everybody
        await pause(300);
        for (const name of VARIABLES) {
            const final = inEngine(name);
            should(tornness(final)).eql(null, `${name} in the engine`);
            for (const session of sessions) {
                const read = await session.read({ nodeId: nodeId(name), attributeId: AttributeIds.Value });
                should(tornness(read)).eql(null, name);
                should(read.value.value).eql(final.value.value, `${name} seen from a front`);
            }
        }
        const finalValue = inEngine("Double0").value.value;
        for (const { values } of monitored) {
            await until(() => values.length > 0 && values[values.length - 1].value.value === finalValue, "the last value reported");
            for (const dataValue of values) should(tornness(dataValue)).eql(null);
        }
        for (const { item } of monitored) await item.terminate();
        for (const subscription of subscriptions) await subscription.terminate();
    });
});
