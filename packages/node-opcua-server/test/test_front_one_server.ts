import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5836;

describe("FrontThreadEngine, one server: fronts give access to the engine's server", function () {
    this.timeout(120000);
    let engine: FrontThreadEngine;
    let ns: number;
    const clients: OPCUAClient[] = [];

    before(async () => {
        engine = await FrontThreadEngine.create({ applicationUri: "urn:test:one-server", serverCapabilities: { maxSessions: 3 } });
        ns = engine.registerNamespace("urn:test:one-server:plant");
        const space = engine.addressSpace;
        const plant = space.addFolder(space.findNode("ns=0;i=85") as never, "Plant");
        space.addVariable({
            nodeId: `ns=${ns};s=Speed`,
            browseName: "Speed",
            componentOf: plant,
            dataType: "Double",
            accessLevel: 3,
            userAccessLevel: 3,
            value: { dataType: DataType.Double, value: 1.5 }
        });
        await engine.start({
            fronts: 2,
            oneServer: true,
            ownPorts: true,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port }
        });
    });
    after(async () => {
        for (const client of clients) await client.disconnect();
        await engine.shutdown();
    });

    /** a session through front k (each front listens on port + k) */
    async function sessionOn(front: number): Promise<ClientSession> {
        const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(`opc.tcp://localhost:${port + front}`);
        clients.push(client);
        return client.createSession();
    }

    it("reads and writes the model, and namespace 0, through either front", async () => {
        const first = await sessionOn(0);
        const second = await sessionOn(1);
        const speed = `ns=${ns};s=Speed`;
        const status = await first.write({
            nodeId: speed,
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: 42 }) })
        });
        should(status).eql(StatusCodes.Good);
        const [value, namespaces, state] = await second.read([
            { nodeId: speed, attributeId: AttributeIds.Value },
            { nodeId: "ns=0;i=2255", attributeId: AttributeIds.Value },
            { nodeId: "ns=0;i=2259", attributeId: AttributeIds.Value }
        ]);
        should(value.value.value).eql(42);
        should(namespaces.value.value).eql(["http://opcfoundation.org/UA/", "urn:test:one-server", "urn:test:one-server:plant"]);
        // ServerStatus.State: Running (0), the engine's
        should(state.value.value).eql(0);
        const browsed = await second.browse({ nodeId: "ns=0;i=85", browseDirection: BrowseDirection.Forward, resultMask: 63 });
        should(browsed.references?.some((r) => r.browseName.name === "Plant")).eql(true);
        await first.close();
        await second.close();
    });

    it("counts the sessions of every front in one place, and shows them in the diagnostics of each", async () => {
        const first = await sessionOn(0);
        const second = await sessionOn(1);
        should(engine.serverEngine.currentSessionCount).eql(2);
        // Server.ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray, read through each front
        for (const session of [first, second]) {
            const array = await session.read({ nodeId: "ns=0;i=3707", attributeId: AttributeIds.Value });
            const names = (array.value.value as { sessionName: string }[]).map((d) => d.sessionName).sort();
            should(names.length).eql(2);
        }
        await first.close();
        await second.close();
        should(engine.serverEngine.currentSessionCount).eql(0);
    });

    it("applies maxSessions to all fronts together", async () => {
        const sessions: ClientSession[] = [];
        for (let k = 0; k < 3; k++) sessions.push(await sessionOn(k % 2));
        await should(sessionOn(1)).be.rejectedWith(/BadTooManySessions/);
        for (const session of sessions) await session.close();
    });
});
