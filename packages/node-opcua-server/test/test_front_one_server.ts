import net from "node:net";
import type { IEventData } from "node-opcua-address-space";
import {
    ClientMonitoredItem,
    type ClientSession,
    type ClientSessionPublishService,
    type ClientSessionRawSubscriptionService,
    ClientSubscription,
    OPCUAClient,
    TimestampsToReturn
} from "node-opcua-client";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { constructEventFilter } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import { DataChangeNotification, PublishRequest, type PublishResponse, type TransferSubscriptionsResponse } from "node-opcua-types";
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
    // the calls of the monitored item hooks of the fixture, counted in the session workers: created, deleted
    const hookCounts = new SharedArrayBuffer(8);

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
            ownPorts: true,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port, hookCounts }
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

    it("serves subscriptions from a session worker: a write through one front reaches a subscriber on the other", async () => {
        const subscriber = await sessionOn(0);
        const writer = await sessionOn(1);
        const subscription = ClientSubscription.create(subscriber, {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
        const values: number[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
            { samplingInterval: 0, queueSize: 10 },
            TimestampsToReturn.Both
        );
        item.on("changed", (dataValue: DataValue) => values.push(dataValue.value.value as number));
        await new Promise<void>((resolve, reject) => {
            item.once("initialized", () => resolve());
            item.once("err", (message: string) => reject(new Error(message)));
        });
        for (const value of [7, 8, 9]) {
            await writer.write({
                nodeId: `ns=${ns};s=Speed`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Double, value }) })
            });
        }
        const end = Date.now() + 5000;
        while (!values.includes(9) && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
        should(values).containEql(9);
        should(engine.serverEngine.currentSessionCount).eql(2);
        await subscription.terminate();
        await subscriber.close();
        await writer.close();
    });

    it("monitors node objects of namespace 0 from a session worker, sampled and on change", async () => {
        const session = await sessionOn(1);
        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
        async function monitor(nodeId: string, samplingInterval: number): Promise<DataValue[]> {
            const values: DataValue[] = [];
            const item = ClientMonitoredItem.create(
                subscription,
                { nodeId, attributeId: AttributeIds.Value },
                { samplingInterval, queueSize: 10 },
                TimestampsToReturn.Both
            );
            item.on("changed", (dataValue: DataValue) => values.push(dataValue));
            await new Promise<void>((resolve, reject) => {
                item.once("initialized", () => resolve());
                item.once("err", (message: string) => reject(new Error(message)));
            });
            return values;
        }
        // Server.ServerStatus.CurrentTime, read through the engine at each sample
        const times = await monitor("ns=0;i=2258", 100);
        // ServerConfiguration.MaxTrustListSize, a value the application sets in the engine: pushed as it changes
        // (a value a getter computes, ServiceLevel, is the getter's: sampled through the engine)
        const levels = await monitor("ns=0;i=12640", 0);
        const maxTrustListSize = engine.serverEngine.addressSpace?.findNode("ns=0;i=12640") as unknown as {
            setValueFromSource(value: { dataType: DataType; value: number }): void;
        };
        maxTrustListSize.setValueFromSource({ dataType: DataType.UInt32, value: 123 });
        const end = Date.now() + 5000;
        while ((times.length < 3 || !levels.some((v) => v.value.value === 123)) && Date.now() < end) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        should(times.length >= 3).eql(true, "CurrentTime sampled");
        should(times[0].value.dataType).eql(DataType.DateTime);
        should(levels.some((v) => v.value.value === 123)).eql(true, "MaxTrustListSize pushed");
        await subscription.terminate();
        await session.close();
    });

    it("delivers the events of the Server object to an event item of a session worker, filtered by the engine", async () => {
        const session = await sessionOn(0);
        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
        const messages: string[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: "ns=0;i=2253", attributeId: AttributeIds.EventNotifier },
            { queueSize: 10, filter: constructEventFilter(["EventType", "Message"]) },
            TimestampsToReturn.Both
        );
        item.on("changed", (fields: unknown) => {
            const [, message] = fields as Variant[];
            messages.push((message?.value as { text?: string } | null)?.text ?? "");
        });
        await new Promise<void>((resolve, reject) => {
            item.once("initialized", () => resolve());
            item.once("err", (message: string) => reject(new Error(message)));
        });
        const server = engine.serverEngine.addressSpace?.rootFolder.objects.server;
        server?.raiseEvent("BaseEventType", { message: { dataType: DataType.LocalizedText, value: { text: "from the engine" } } });
        const end = Date.now() + 5000;
        while (!messages.includes("from the engine") && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
        should(messages).containEql("from the engine");
        await subscription.terminate();
        await session.close();
    });

    it("runs the monitored item hooks of the application in the session worker", async () => {
        const counts = new Int32Array(hookCounts);
        const [created0, deleted0] = [Atomics.load(counts, 0), Atomics.load(counts, 1)];
        const session = await sessionOn(0);
        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
        const items = [0, 1].map(() =>
            ClientMonitoredItem.create(
                subscription,
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
                { samplingInterval: 100, queueSize: 1 },
                TimestampsToReturn.Both
            )
        );
        await Promise.all(items.map((item) => new Promise<void>((resolve) => item.once("initialized", () => resolve()))));
        should(Atomics.load(counts, 0) - created0).eql(2, "onCreateMonitoredItem, once per item");
        await items[0].terminate();
        should(Atomics.load(counts, 1) - deleted0).eql(1, "onDeleteMonitoredItem for the item deleted");
        // the other item ends with its session
        await session.close(true);
        const end = Date.now() + 5000;
        while (Atomics.load(counts, 1) - deleted0 < 2 && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
        should(Atomics.load(counts, 1) - deleted0).eql(2, "onDeleteMonitoredItem for the item of the closed session");
    });
});

describe("FrontThreadEngine, one server: TransferSubscriptions between sessions of the session workers", function () {
    this.timeout(120000);
    const transferPort = 5840;
    let engine: FrontThreadEngine;
    let ns: number;
    const clients: OPCUAClient[] = [];

    before(async () => {
        engine = await FrontThreadEngine.create({
            applicationUri: "urn:test:one-server-transfer",
            allowAnonymousSubscriptionTransferOnUnsecuredChannel: true,
            diagnosticsNamespaceUri: "urn:test:one-server-transfer:runtime"
        });
        ns = engine.registerNamespace("urn:test:one-server-transfer:plant");
        engine.addressSpace.addVariable({
            nodeId: `ns=${ns};s=Level`,
            browseName: "Level",
            organizedBy: engine.addressSpace.findNode("ns=0;i=85") as never,
            dataType: "Double",
            accessLevel: 3,
            userAccessLevel: 3,
            value: { dataType: DataType.Double, value: 0 }
        });
        await engine.start({
            fronts: 2,
            ownPorts: true,
            // sessions go to the least loaded worker: the 1st and 3rd on worker 0, the 2nd on worker 1
            sessionWorkers: 2,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port: transferPort }
        });
    });
    after(async () => {
        for (const client of clients) await client.disconnect();
        await engine.shutdown();
    });

    /** a session through front k, with the raw subscription services (what ClientSubscription does under the hood) */
    type RawSession = ClientSession & ClientSessionRawSubscriptionService & ClientSessionPublishService;
    async function sessionOn(front: number): Promise<RawSession> {
        const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(`opc.tcp://localhost:${transferPort + front}`);
        clients.push(client);
        return (await client.createSession()) as RawSession;
    }

    function publish(session: RawSession): Promise<PublishResponse> {
        return new Promise((resolve, reject) =>
            session.publish(new PublishRequest({ subscriptionAcknowledgements: [] }), (err, response) =>
                err || !response ? reject(err ?? new Error("no response")) : resolve(response)
            )
        );
    }

    function transferTo(
        session: RawSession,
        subscriptionId: number,
        sendInitialValues = true
    ): Promise<TransferSubscriptionsResponse> {
        return new Promise((resolve, reject) =>
            session.transferSubscriptions({ subscriptionIds: [subscriptionId], sendInitialValues }, (err, response) =>
                err || !response ? reject(err ?? new Error("no response")) : resolve(response)
            )
        );
    }

    /** a subscription and an item on Level, without a client subscription object (it would publish itself) */
    async function subscribe(session: RawSession): Promise<number> {
        const created = await session.createSubscription({
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 0
        });
        const items = await session.createMonitoredItems({
            subscriptionId: created.subscriptionId,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: { nodeId: `ns=${ns};s=Level`, attributeId: AttributeIds.Value },
                    monitoringMode: 2,
                    requestedParameters: { clientHandle: 42, samplingInterval: 0, queueSize: 10, discardOldest: true }
                }
            ]
        });
        should(items.results?.[0].statusCode).eql(StatusCodes.Good);
        return created.subscriptionId;
    }

    /** writes Level, then publishes on `session` until the value arrives for the item (clientHandle 42) */
    async function receives(session: RawSession, writer: RawSession, value: number): Promise<void> {
        await writer.write({
            nodeId: `ns=${ns};s=Level`,
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.Double, value }) })
        });
        for (let k = 0; k < 20; k++) {
            const response = await publish(session);
            for (const data of response.notificationMessage.notificationData ?? []) {
                if (!(data instanceof DataChangeNotification)) continue;
                if (data.monitoredItems?.some((item) => item.clientHandle === 42 && item.value.value.value === value)) return;
            }
        }
        throw new Error(`value ${value} not received`);
    }

    it("gives the sessions of every front their NodeId and diagnostics in the engine's diagnostics namespace", async () => {
        const session = await sessionOn(1);
        const namespaces = (await session.read({ nodeId: "ns=0;i=2255", attributeId: AttributeIds.Value })).value.value as string[];
        const index = namespaces.indexOf("urn:test:one-server-transfer:runtime");
        should(index > 1).eql(true);
        should(session.sessionId.namespace).eql(index);
        const children = await session.browse({
            nodeId: session.sessionId,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HasComponent",
            resultMask: 63
        });
        should((children.references ?? []).some((r) => r.browseName.name === "SessionDiagnostics")).eql(true);
        await session.close();
    });

    it("transfers a subscription to a session of the same session worker", async () => {
        const first = await sessionOn(0); // worker 0
        const second = await sessionOn(1); // worker 1
        const third = await sessionOn(1); // worker 0
        const subscriptionId = await subscribe(first);
        const transfer = await transferTo(third, subscriptionId);
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        await receives(third, second, 1);
        for (const session of [first, second, third]) await session.close();
    });

    it("transfers a subscription to a session of another session worker, with its id, items and sequence numbers", async () => {
        const first = await sessionOn(0); // worker 0
        const second = await sessionOn(1); // worker 1
        const subscriptionId = await subscribe(first);
        await receives(first, second, 2);
        const transfer = await transferTo(second, subscriptionId);
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        // the messages the first session did not acknowledge come along
        should((transfer.results?.[0].availableSequenceNumbers ?? []).length > 0).eql(true);
        await receives(second, first, 3);
        for (const session of [first, second]) await session.close();
    });

    it("does not send the current values of a subscription taken from another worker with sendInitialValues false", async () => {
        const first = await sessionOn(0); // worker 0
        const second = await sessionOn(1); // worker 1
        const subscriptionId = await subscribe(first);
        await receives(first, second, 6);
        const transfer = await transferTo(second, subscriptionId, false);
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        // the first Publish after the transfer: a keep-alive, not the value 6 the client already has
        const response = await publish(second);
        const values = (response.notificationMessage.notificationData ?? [])
            .filter((data): data is DataChangeNotification => data instanceof DataChangeNotification)
            .flatMap((data) => (data.monitoredItems ?? []).filter((item) => item.clientHandle === 42));
        should(values.length).eql(0);
        // a change after the transfer is reported
        await receives(second, first, 7);
        for (const session of [first, second]) await session.close();
    });

    it("transfers the subscription of a session closed without deleting it, from another session worker", async () => {
        const first = await sessionOn(0); // worker 0
        const second = await sessionOn(1); // worker 1
        const subscriptionId = await subscribe(first);
        // closed, its subscription kept for a later TransferSubscriptions
        await first.close(false);
        const transfer = await transferTo(second, subscriptionId);
        should(transfer.results?.[0].statusCode).eql(StatusCodes.Good);
        await receives(second, second, 4);
        await second.close();
    });
});
