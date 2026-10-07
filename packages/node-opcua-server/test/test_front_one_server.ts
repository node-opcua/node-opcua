import net from "node:net";
import type { IEventData } from "node-opcua-address-space";
import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

const port = 5836;
// one address for both fronts, as SO_REUSEPORT gives: each new connection goes to the next front in turn
const sharedPort = 5839;

function roundRobin(fronts: number[]): net.Server {
    let next = 0;
    return net.createServer((socket) => {
        const front = net.connect(fronts[next++ % fronts.length], "localhost");
        socket.pipe(front).pipe(socket);
        socket.on("error", () => front.destroy());
        front.on("error", () => socket.destroy());
    });
}

describe("FrontThreadEngine, one server: fronts give access to the engine's server", function () {
    this.timeout(120000);
    let engine: FrontThreadEngine;
    let ns: number;
    const clients: OPCUAClient[] = [];

    before(async () => {
        engine = await FrontThreadEngine.create({
            applicationUri: "urn:test:one-server",
            serverCapabilities: { maxSessions: 3 },
            isAuditing: true
        });
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

    /** a client connected to front k (each front listens on port + k) */
    async function clientOn(front: number, requestedSessionTimeout?: number): Promise<OPCUAClient> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: { maxRetry: 0 },
            requestedSessionTimeout
        });
        await client.connect(`opc.tcp://localhost:${port + front}`);
        clients.push(client);
        return client;
    }

    async function sessionOn(front: number): Promise<ClientSession> {
        return (await clientOn(front)).createSession();
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

    it("lets a session go on through the other front (ActivateSession on a new channel)", async () => {
        const proxy = roundRobin([port, port + 1]);
        await new Promise<void>((resolve) => proxy.listen(sharedPort, resolve));
        const connectShared = async () => {
            const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
            await client.connect(`opc.tcp://localhost:${sharedPort}`);
            clients.push(client);
            return client;
        };
        // the first connection lands on front 0, the second on front 1
        const session = await (await connectShared()).createSession();
        const other = await connectShared();
        // the client moves its session to a channel of front 1, which takes it over from front 0
        await other.reactivateSession(session);
        const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.Good);
        should(engine.serverEngine.currentSessionCount).eql(1);
        await session.close();
        should(engine.serverEngine.currentSessionCount).eql(0);
        proxy.close();
    });

    it("raises the audit events of a front on the engine's Server object", async () => {
        const server = engine.serverEngine.addressSpace?.rootFolder.objects.server;
        const raised: string[] = [];
        // the source of an event's data is its event type
        const listener = (eventData: IEventData) => {
            raised.push(eventData.getEventDataSource().nodeId.toString());
        };
        server?.on("event", listener);
        const session = await sessionOn(1);
        await session.close();
        server?.removeListener("event", listener);
        // AuditCreateSessionEventType (i=2071) and AuditActivateSessionEventType (i=2075)
        should(raised).containEql("ns=0;i=2071");
        should(raised).containEql("ns=0;i=2075");
    });

    it("closes the front's half of a session the engine timed out", async () => {
        const client = await clientOn(0, 1000);
        const session = await client.createSession();
        should(engine.serverEngine.currentSessionCount).eql(1);
        // nothing sent for longer than the timeout: the engine's watchdog closes the session
        await new Promise((resolve) => setTimeout(resolve, 4000));
        should(engine.serverEngine.currentSessionCount).eql(0);
        const timedOut = session.sessionId.toString();
        // the front no longer knows the session (BadSessionIdInvalid): the client makes a new one and reads again
        const value = await session.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.Good);
        should(session.sessionId.toString()).not.eql(timedOut);
        should(engine.serverEngine.currentSessionCount).eql(1);
        await session.close();
    });
});
