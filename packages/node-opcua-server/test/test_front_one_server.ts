import net from "node:net";
import type { IEventData, UAConditionEx } from "node-opcua-address-space";
import {
    ClientMonitoredItem,
    type ClientSession,
    type ClientSessionPublishService,
    type ClientSessionRawSubscriptionService,
    ClientSubscription,
    OPCUAClient,
    TimestampsToReturn,
    UserTokenType
} from "node-opcua-client";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import { constructEventFilter, ofType } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import {
    CreateSessionRequest,
    CreateSubscriptionRequest,
    DataChangeNotification,
    PublishRequest,
    type PublishResponse,
    type TransferSubscriptionsResponse
} from "node-opcua-types";
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
            serverModuleData: { port, hookCounts, users: true }
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

    it("takes no room for a CreateSession it refuses", async () => {
        // more refused requests than maxSessions (3): each would hold a place for good if the engine kept one
        for (let k = 0; k < 4; k++) {
            const client = await clientOn(k % 2);
            const internal = client as unknown as {
                performMessageTransaction(request: { clientNonce?: Buffer }, callback: unknown): void;
            };
            const send = internal.performMessageTransaction.bind(internal);
            internal.performMessageTransaction = (request, callback) => {
                // longer than any nonce the server accepts: refused with BadNonceInvalid
                if (request instanceof CreateSessionRequest) request.clientNonce = Buffer.alloc(4096, 0x42);
                send(request, callback);
            };
            await should(client.createSession()).be.rejectedWith(/BadNonceInvalid/);
            internal.performMessageTransaction = send;
        }
        const sessions: ClientSession[] = [];
        for (let k = 0; k < 3; k++) sessions.push(await sessionOn(k % 2));
        should(engine.serverEngine.currentSessionCount).eql(3);
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

    it("runs a ConditionRefresh for a subscription of a session worker, and for that subscription only", async () => {
        // a retained condition in the engine, its events reaching the Server object
        const addressSpace = engine.serverEngine.addressSpace;
        if (!addressSpace) throw new Error("no address space");
        addressSpace.installAlarmsAndConditionsService();
        const namespace = addressSpace.getOwnNamespace();
        const objects = addressSpace.rootFolder.objects;
        const area = namespace.addObject({
            browseName: "Area",
            eventNotifier: 1,
            notifierOf: objects.server,
            organizedBy: objects
        });
        const boiler = namespace.addObject({ browseName: "Boiler", componentOf: area, eventSourceOf: area });
        const conditionType = namespace.addObjectType({ browseName: "BoilerConditionType", subtypeOf: "ConditionType" });
        const condition = namespace.instantiateCondition(conditionType, {
            browseName: "BoilerCondition",
            conditionSource: boiler,
            organizedBy: objects
        }) as UAConditionEx;
        condition.currentBranch().setRetain(true);

        const session = await sessionOn(1);
        /** a subscription with one item on the Server object's events; the EventTypes it received */
        async function eventSubscription(where?: ReturnType<typeof ofType>) {
            const subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                publishingEnabled: true
            });
            await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
            const eventTypes: string[] = [];
            const item = ClientMonitoredItem.create(
                subscription,
                { nodeId: "ns=0;i=2253", attributeId: AttributeIds.EventNotifier },
                { queueSize: 100, filter: constructEventFilter(["EventType"], where) },
                TimestampsToReturn.Both
            );
            item.on("changed", (fields: unknown) => eventTypes.push(String((fields as Variant[])[0]?.value)));
            await new Promise<void>((resolve, reject) => {
                item.once("initialized", () => resolve());
                item.once("err", (message: string) => reject(new Error(message)));
            });
            return { subscription, eventTypes };
        }
        // a where clause that only lets conditions through: the bracket goes through it all the same (OPC 10000-9 4.5)
        const refreshed = await eventSubscription(ofType("ConditionType"));
        const other = await eventSubscription();
        const conditionRefresh = (subscriptionId: number) =>
            session.call({
                objectId: "ns=0;i=2782",
                methodId: "ns=0;i=3875",
                inputArguments: [{ dataType: DataType.UInt32, value: subscriptionId }]
            });

        should((await conditionRefresh(refreshed.subscription.subscriptionId)).statusCode).eql(StatusCodes.Good);
        const end = Date.now() + 5000;
        while (!refreshed.eventTypes.includes("ns=0;i=2788") && Date.now() < end) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        // RefreshStartEventType, the retained condition, RefreshEndEventType
        should(refreshed.eventTypes).eql(["ns=0;i=2787", conditionType.nodeId.toString(), "ns=0;i=2788"]);
        // the other subscription of the session saw nothing of it
        await new Promise((resolve) => setTimeout(resolve, 300));
        should(other.eventTypes).eql([]);
        // a subscription the session does not have
        should((await conditionRefresh(4242)).statusCode).eql(StatusCodes.BadSubscriptionIdInvalid);

        await refreshed.subscription.terminate();
        await other.subscription.terminate();
        await session.close();
    });

    it("runs GetMonitoredItems, ResendData and SetSubscriptionDurable on the subscription of a session worker", async () => {
        const session = await sessionOn(0);
        const create = async () => {
            const subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                publishingEnabled: true
            });
            await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
            return subscription;
        };
        const subscription = await create();
        const values: number[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
            { samplingInterval: 0, queueSize: 10 },
            TimestampsToReturn.Both
        );
        item.on("changed", (dataValue: DataValue) => values.push(dataValue.value.value as number));
        await new Promise<void>((resolve) => item.once("initialized", () => resolve()));
        const waitFor = async (condition: () => boolean) => {
            const end = Date.now() + 5000;
            while (!condition() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
        };
        await waitFor(() => values.length > 0);
        // Server.GetMonitoredItems (i=11492), Server.ResendData (i=12873), Server.SetSubscriptionDurable (i=12749)
        const method = (methodId: number, ...args: number[]) => ({
            objectId: "ns=0;i=2253",
            methodId: `ns=0;i=${methodId}`,
            inputArguments: args.map((value) => ({ dataType: DataType.UInt32, value }))
        });

        const listed = await session.call(method(11492, subscription.subscriptionId));
        should(listed.statusCode).eql(StatusCodes.Good);
        should(Array.from(listed.outputArguments?.[0].value as Uint32Array)).eql([item.monitoredItemId]);
        should(Array.from(listed.outputArguments?.[1].value as Uint32Array)).eql([item.monitoringParameters.clientHandle]);

        const received = values.length;
        should((await session.call(method(12873, subscription.subscriptionId))).statusCode).eql(StatusCodes.Good);
        await waitFor(() => values.length > received);
        should(values.length).eql(received + 1, "ResendData sends the current value again");

        // durable only before the first item (OPC 10000-5 9.3)
        should((await session.call(method(12749, subscription.subscriptionId, 5))).statusCode).eql(StatusCodes.BadInvalidState);
        const empty = await create();
        const durable = await session.call(method(12749, empty.subscriptionId, 5));
        should(durable.statusCode).eql(StatusCodes.Good);
        should(durable.outputArguments?.[0].value).eql(5);

        // several in one Call, as for any method
        const both = await session.call([method(11492, subscription.subscriptionId), method(12873, empty.subscriptionId)]);
        should(both.map((result) => result.statusCode)).eql([StatusCodes.Good, StatusCodes.Good]);
        // a subscription of another session is denied, an unknown one invalid
        const other = await sessionOn(1);
        should((await other.call(method(11492, subscription.subscriptionId))).statusCode).eql(StatusCodes.BadUserAccessDenied);
        should((await session.call(method(11492, 4242))).statusCode).eql(StatusCodes.BadSubscriptionIdInvalid);

        await subscription.terminate();
        await empty.terminate();
        await other.close();
        await session.close();
    });

    it("refuses a subscription service sent with the token of a session of another channel", async () => {
        const owner = await sessionOn(0);
        const otherClient = await clientOn(0);
        const other = await otherClient.createSession();
        // the other connection sends a request with the owner's token, as one that read it on the wire would,
        // straight on its channel (a ClientSession would repair itself by activating the owner's session there)
        const internal = otherClient as unknown as {
            performMessageTransaction(
                request: CreateSubscriptionRequest,
                callback: (err: Error | null, response?: unknown) => void
            ): void;
        };
        const request = new CreateSubscriptionRequest({
            requestHeader: { authenticationToken: (owner as unknown as { authenticationToken: NodeId }).authenticationToken },
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        const response = await new Promise<unknown>((resolve) =>
            internal.performMessageTransaction(request, (err, r) => resolve(err ?? r))
        );
        should(
            String((response as { responseHeader?: { serviceResult: unknown } }).responseHeader?.serviceResult ?? response)
        ).match(/BadSecureChannelIdInvalid/);
        // the owner goes on as before
        const value = await owner.read({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.Good);
        await other.close();
        await owner.close();
    });

    it("filters the events of an item with the roles its session has now, after a change of user", async () => {
        const client = await clientOn(0);
        const session = await client.createSession();
        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 50,
            requestedLifetimeCount: 600,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        });
        await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
        const eventTypes: string[] = [];
        const item = ClientMonitoredItem.create(
            subscription,
            { nodeId: "ns=0;i=2253", attributeId: AttributeIds.EventNotifier },
            { queueSize: 100, filter: constructEventFilter(["EventType"]) },
            TimestampsToReturn.Both
        );
        item.on("changed", (fields: unknown) => eventTypes.push(String((fields as Variant[])[0]?.value)));
        await new Promise<void>((resolve) => item.once("initialized", () => resolve()));
        // AuditActivateSessionEventType (i=2075): raised when another session is activated
        const activateAnother = async () => {
            const other = await sessionOn(1);
            await other.close();
        };
        await activateAnother();
        await new Promise((resolve) => setTimeout(resolve, 500));
        should(eventTypes).not.containEql("ns=0;i=2075", "an anonymous session receives no audit event");

        const changed = await client.changeSessionIdentity(session, {
            type: UserTokenType.UserName,
            userName: "admin",
            password: "admin-pw"
        });
        should(changed).eql(StatusCodes.Good);
        await activateAnother();
        const end = Date.now() + 5000;
        while (!eventTypes.includes("ns=0;i=2075") && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 50));
        should(eventTypes).containEql("ns=0;i=2075", "the same session as SecurityAdmin receives them");
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

describe("FrontThreadEngine, one server: a session worker that ends", function () {
    this.timeout(120000);
    const endPort = 5844;

    it("closes its sessions, answers what waited on it, and serves new sessions from the other worker", async () => {
        const engine = await FrontThreadEngine.create({ applicationUri: "urn:test:worker-ends" });
        const ns = engine.registerNamespace("urn:test:worker-ends:plant");
        engine.addressSpace.addVariable({
            nodeId: `ns=${ns};s=Level`,
            browseName: "Level",
            organizedBy: engine.addressSpace.findNode("ns=0;i=85") as never,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1.25 }
        });
        await engine.start({
            fronts: 1,
            ownPorts: true,
            sessionWorkers: 2,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port: endPort, endWorkerOnFirstItem: true }
        });
        const clients: OPCUAClient[] = [];
        const connect = async () => {
            const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
            await client.connect(`opc.tcp://localhost:${endPort}`);
            clients.push(client);
            return client.createSession();
        };
        try {
            const first = await connect();
            const subscription = ClientSubscription.create(first, {
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                publishingEnabled: true
            });
            await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
            // GetMonitoredItems waits on the worker: answered when it ends
            const listed = first.call({
                objectId: "ns=0;i=2253",
                methodId: "ns=0;i=11492",
                inputArguments: [{ dataType: DataType.UInt32, value: subscription.subscriptionId }]
            });
            // its first monitored item ends the worker of this session
            ClientMonitoredItem.create(
                subscription,
                { nodeId: `ns=${ns};s=Level`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 1 },
                TimestampsToReturn.Both
            );
            const end = Date.now() + 10000;
            while (engine.serverEngine.currentSessionCount > 0 && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
            should(engine.serverEngine.currentSessionCount).eql(0, "the session of the worker that ended is closed");
            await Promise.race([listed.catch(() => undefined), new Promise((r) => setTimeout(r, 5000))]);
            // a new session goes to the other worker, and is served
            const second = await connect();
            const value = await second.read({ nodeId: `ns=${ns};s=Level`, attributeId: AttributeIds.Value });
            should(value.value.value).eql(1.25);
            await second.close();
        } finally {
            for (const client of clients) await client.disconnect();
            await engine.shutdown();
        }
    });
});

describe("FrontThreadEngine, one server: one module as the front worker and its serverModule", function () {
    this.timeout(60000);
    const onePort = 5843;

    it("serves a subscription from the session worker, which imports that module for its hooks, and stops", async () => {
        const engine = await FrontThreadEngine.create({ applicationUri: "urn:test:one-module" });
        const ns = engine.registerNamespace("urn:test:one-module:plant");
        engine.addressSpace.addVariable({
            nodeId: `ns=${ns};s=Level`,
            browseName: "Level",
            organizedBy: engine.addressSpace.findNode("ns=0;i=85") as never,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 3.5 }
        });
        const module = new URL("./fixtures/front_threads_worker_and_options.mjs", import.meta.url);
        await engine.start({
            fronts: 1,
            ownPorts: true,
            workerScript: module,
            serverModule: module,
            serverModuleData: { port: onePort }
        });
        const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        try {
            await client.connect(`opc.tcp://localhost:${onePort}`);
            const session = await client.createSession();
            const subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                publishingEnabled: true
            });
            await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
            const item = ClientMonitoredItem.create(
                subscription,
                { nodeId: `ns=${ns};s=Level`, attributeId: AttributeIds.Value },
                { samplingInterval: 0, queueSize: 1 },
                TimestampsToReturn.Both
            );
            const value = await new Promise<number>((resolve) =>
                item.once("changed", (dataValue: DataValue) => resolve(dataValue.value.value))
            );
            should(value).eql(3.5);
            await session.close();
        } finally {
            await client.disconnect();
            // before, the session worker ran the front worker's code too, and never answered the stop
            await engine.shutdown();
        }
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

    it("gives MonitoredItems ids unique across the session workers, kept unique after a transfer", async () => {
        // two sessions in a row go to the two workers (least loaded first)
        const sessions = [await sessionOn(0), await sessionOn(1)];
        const itemOn = async (session: RawSession, subscriptionId: number) => {
            const items = await session.createMonitoredItems({
                subscriptionId,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: [
                    {
                        itemToMonitor: { nodeId: `ns=${ns};s=Level`, attributeId: AttributeIds.Value },
                        monitoringMode: 2,
                        requestedParameters: { clientHandle: 7, samplingInterval: 0, queueSize: 1, discardOldest: true }
                    }
                ]
            });
            return items.results?.[0].monitoredItemId ?? 0;
        };
        const subscriptionIds: number[] = [];
        const ids: number[] = [];
        for (const session of sessions) {
            const created = await session.createSubscription({
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 0,
                publishingEnabled: true,
                priority: 0
            });
            subscriptionIds.push(created.subscriptionId);
            ids.push(await itemOn(session, created.subscriptionId));
        }
        // one counter for both workers
        should(ids[1]).eql(ids[0] + 1);
        // the subscription of the first moves to the second worker, which gives it a new item
        should((await transferTo(sessions[1], subscriptionIds[0])).results?.[0].statusCode).eql(StatusCodes.Good);
        const added = await itemOn(sessions[1], subscriptionIds[0]);
        should([ids[0], ids[1]]).not.containEql(added);
        for (const session of sessions) await session.close();
    });

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
