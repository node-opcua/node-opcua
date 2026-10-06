import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { AttributeIds, BrowseDirection, NodeClass, ResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5826;

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
});
