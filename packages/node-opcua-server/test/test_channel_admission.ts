import net from "node:net";
import { type ClientSession, ClientSubscription, OPCUAClient, type OPCUAClientOptions } from "node-opcua-client";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../dist/index.js";

const port = 5829;
/** a TCP proxy in front of the server, which can stop reading what the server sends */
const proxyPort = 5830;

const BIG_ELEMENTS = 1024 * 1024; // 4 MB of Int32

/**
 * A channel starts a request only while the responses already on their way leave room
 * (ServerSecureChannelLayer, CHANNEL_RESPONSE_BUDGET of 16 MB): a client pipelining reads of
 * large values gets them a few at a time, instead of the server building them all at once.
 */
describe("a secure channel starts requests as fast as their responses leave", function () {
    this.timeout(120_000);
    let server: OPCUAServer;
    const clients: OPCUAClient[] = [];
    let session: ClientSession;
    let ns: number;
    // the refreshes of the slow values: in progress now, the most at once, and started in all
    let inProgress = 0;
    let maxInProgress = 0;
    let started = 0;

    /** a value answered `delay` ms after it is asked: the reads of a pipeline overlap in the server */
    function slowValue(make: () => Variant, delay = 20) {
        return {
            refreshFunc(callback: (err: Error | null, dataValue?: DataValue) => void) {
                inProgress++;
                started++;
                maxInProgress = Math.max(maxInProgress, inProgress);
                setTimeout(() => {
                    inProgress--;
                    callback(null, new DataValue({ value: make(), sourceTimestamp: new Date() }));
                }, delay);
            }
        };
    }

    async function openSession(endpointPort: number, options?: OPCUAClientOptions): Promise<ClientSession> {
        const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 }, ...options });
        await client.connect(`opc.tcp://localhost:${endpointPort}`);
        clients.push(client);
        return client.createSession();
    }

    before(async () => {
        server = new OPCUAServer({ port, nodeset_filename: [nodesets.standard] });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        ns = namespace.index;
        const big = new Int32Array(BIG_ELEMENTS);
        const bigVariant = () => new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: big });
        const organizedBy = addressSpace.rootFolder.objects;
        for (let i = 0; i < 16; i++) {
            namespace.addVariable({
                nodeId: `s=Big${i}`,
                browseName: `Big${i}`,
                organizedBy,
                dataType: "Int32",
                valueRank: 1,
                value: slowValue(bigVariant)
            });
            namespace.addVariable({
                nodeId: `s=SlowBig${i}`,
                browseName: `SlowBig${i}`,
                organizedBy,
                dataType: "Int32",
                valueRank: 1,
                value: slowValue(bigVariant, 300)
            });
        }
        for (let i = 0; i < 32; i++) {
            namespace.addVariable({
                nodeId: `s=Small${i}`,
                browseName: `Small${i}`,
                organizedBy,
                dataType: "Int32",
                value: slowValue(() => new Variant({ dataType: DataType.Int32, value: i }))
            });
        }
        namespace.addVariable({
            nodeId: "s=Target",
            browseName: "Target",
            organizedBy,
            dataType: "Int32",
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            value: { dataType: DataType.Int32, value: 0 }
        });
        await server.start();
        session = await openSession(port);
    });
    after(async () => {
        for (const client of clients) await client.disconnect();
        await server?.shutdown();
    });

    function readAll(prefix: string, count: number, on: ClientSession = session) {
        return Promise.all(
            Array.from({ length: count }, (_, i) =>
                on.read({ nodeId: `ns=${ns};s=${prefix}${i}`, attributeId: AttributeIds.Value })
            )
        );
    }

    function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what}: not done after ${ms} ms`)), ms))
        ]);
    }

    it("builds the responses of 16 pipelined 4 MB reads no more than 4 at a time", async () => {
        maxInProgress = 0;
        const values = await readAll("Big", 16);
        for (const value of values) {
            should(value.statusCode).eql(StatusCodes.Good);
            should(value.value.value.length).eql(BIG_ELEMENTS);
        }
        should(maxInProgress).be.belowOrEqual(4);
        should(maxInProgress).be.aboveOrEqual(1);
    });

    it("lets the pipelined reads of small values run together", async () => {
        // the size of the Read responses is known by now: they are large; a few small ones first
        await readAll("Small", 8);
        await readAll("Small", 8);
        maxInProgress = 0;
        const values = await readAll("Small", 32);
        for (const value of values) should(value.statusCode).eql(StatusCodes.Good);
        should(maxInProgress).be.above(4);
    });

    it("never counts the PublishRequests the server holds: a channel with 10 of them still answers", async () => {
        const other = await openSession(port, { requestedSessionTimeout: 600_000 });
        // each subscription makes the client keep 5 PublishRequests at the server, held there until
        // its first publishing cycle (10 s): counted as requests in progress, they would fill the budget
        // and the reads would wait for that cycle
        const subscriptions: ClientSubscription[] = [];
        for (let k = 0; k < 2; k++) {
            subscriptions.push(
                await ClientSubscription.create(other, {
                    requestedPublishingInterval: 10_000,
                    requestedMaxKeepAliveCount: 3,
                    requestedLifetimeCount: 30,
                    publishingEnabled: true
                })
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        const values = await within(readAll("Small", 4, other), 2000, "reads behind held PublishRequests");
        for (const value of values) should(value.statusCode).eql(StatusCodes.Good);
        for (const subscription of subscriptions) await subscription.terminate();
        await other.close();
    });

    it("starts nothing more while the socket holds a budget's worth, and resumes when it drains", async () => {
        // the proxy relays the client's requests, and stops reading the server's responses on demand
        let upstream: net.Socket | undefined;
        let downstream: net.Socket | undefined;
        const proxy = net.createServer((socket) => {
            downstream = socket;
            upstream = net.connect(port, "localhost");
            socket.pipe(upstream);
            upstream.pipe(socket);
        });
        await new Promise<void>((resolve) => proxy.listen(proxyPort, resolve));
        try {
            const viaProxy = await openSession(proxyPort);
            const up = upstream as net.Socket;
            const down = downstream as net.Socket;
            // the server's responses stop leaving: they fill the socket buffers, then the queue of its socket
            up.unpipe(down);
            up.pause();
            started = 0;
            const reads = readAll("Big", 16, viaProxy);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const startedWhileStalled = started;
            should(startedWhileStalled).be.below(16, "a full socket stops the channel from starting more");
            up.pipe(down);
            up.resume();
            const values = await within(reads, 30_000, "reads after the socket drained");
            for (const value of values) should(value.statusCode).eql(StatusCodes.Good);
            should(started).eql(16);
            await viaProxy.close();
        } finally {
            upstream?.destroy();
            downstream?.destroy();
            await new Promise<void>((resolve) => proxy.close(() => resolve()));
        }
    });

    it("does not let the small answers of one service open the gate to the large answers of another", async () => {
        // a fresh channel, whose first answers are small (a session is set up with small answers too)
        const fresh = await openSession(port);
        for (let k = 0; k < 8; k++) {
            await fresh.write({
                nodeId: `ns=${ns};s=Target`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value: k }) })
            });
        }
        maxInProgress = 0;
        const values = await readAll("Big", 16, fresh);
        for (const value of values) should(value.statusCode).eql(StatusCodes.Good);
        should(maxInProgress).be.belowOrEqual(4, "the Reads, never answered on this channel, count at 4 MB each");
        await fresh.close();
    });

    it("keeps an estimate per service: small Writes start while large Reads are in progress", async () => {
        const write = (value: number) =>
            session.write({
                nodeId: `ns=${ns};s=Target`,
                attributeId: AttributeIds.Value,
                value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value }) })
            });
        // the channel learns that Writes answer little and Reads of these values answer 4 MB
        await write(1);
        await write(2);
        await readAll("SlowBig", 1);
        let readsDone = false;
        const reads = readAll("SlowBig", 2).then((values) => {
            readsDone = true;
            return values;
        });
        const statuses = await Promise.all(Array.from({ length: 10 }, (_, k) => write(10 + k)));
        should(statuses).eql(Array(10).fill(StatusCodes.Good));
        should(readsDone).eql(false, "the Writes did not wait for the Reads (300 ms each) to be answered");
        await reads;
    });

    it("releases the place of a request whose response cannot be sent", async () => {
        // a client that takes no message larger than 1 MB: every 4 MB response fails to be sent, and
        // the server answers with a ServiceFault instead
        const small = await openSession(port, { transportSettings: { maxMessageSize: 1024 * 1024 } });
        const outcomes = await within(
            Promise.allSettled(
                Array.from({ length: 12 }, (_, i) => small.read({ nodeId: `ns=${ns};s=Big${i}`, attributeId: AttributeIds.Value }))
            ),
            30_000,
            "reads whose responses are too large"
        );
        should(outcomes.length).eql(12);
        for (const outcome of outcomes) {
            const bad = outcome.status === "rejected" || outcome.value.statusCode !== StatusCodes.Good;
            should(bad).eql(true, "a 4 MB value cannot reach this client");
        }
        // 12 failed responses, more than the 4 the budget lets in: none of them kept its place
        const value = await within(
            small.read({ nodeId: `ns=${ns};s=Small0`, attributeId: AttributeIds.Value }),
            5000,
            "a read after them"
        );
        should(value.statusCode).eql(StatusCodes.Good);
        await small.close();
    });
});
