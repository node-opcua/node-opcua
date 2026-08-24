import { EventEmitter } from "node:events";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";
import type { OPCUAServerEndPoint, ReverseConnectManagerContext } from "..";
import { ReverseConnectManager } from "..";

/**
 * Unit tests for the server-side Reverse Connect dial loop (ReverseConnectManager).
 *
 * These are pure unit tests: the manager takes an injectable ReverseConnectManagerContext, so we feed
 * it a fake endpoint whose createReverseConnection() we drive by hand and use sinon fake timers to make
 * the backoff scheduling deterministic. No real sockets or server are involved.
 */
type CreateReverseConnection = OPCUAServerEndPoint["createReverseConnection"];

function fakeEndpoint(createReverseConnection: CreateReverseConnection): OPCUAServerEndPoint {
    return { createReverseConnection } as unknown as OPCUAServerEndPoint;
}

function makeContext(getEndpoint: () => OPCUAServerEndPoint | undefined): ReverseConnectManagerContext {
    return {
        getDialEndpoint: getEndpoint,
        getServerUri: () => "urn:test:Server",
        getEndpointUrl: () => "opc.tcp://server:1/UA"
    };
}

describe("ReverseConnectManager dial loop (RC-MGR)", function (this: Mocha.Suite) {
    this.timeout(10000);

    let clock: sinon.SinonFakeTimers | undefined;

    afterEach(() => {
        if (clock) {
            clock.restore();
            clock = undefined;
        }
    });

    it("RC-MGR-1 doubles the backoff on each failed dial and caps it at maxReconnectDelay", () => {
        clock = sinon.useFakeTimers();

        const dialAt: number[] = [];
        // every dial fails synchronously => the manager keeps re-scheduling with exponential backoff
        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null) => void) => {
            dialAt.push(Date.now());
            cb(new Error("dial failed"));
            return undefined;
        }) as unknown as CreateReverseConnection);

        const manager = new ReverseConnectManager(
            makeContext(() => endpoint),
            {
                connections: [{ endpointUrl: "opc.tcp://client:1" }],
                reconnectDelay: 1000,
                maxReconnectDelay: 8000
            }
        );

        manager.start(); //          dial #1 @ t=0     -> retry in 1000 (currentDelay 1000 -> 2000)
        clock.tick(1000); //         dial #2 @ t=1000  -> retry in 2000 (-> 4000)
        clock.tick(2000); //         dial #3 @ t=3000  -> retry in 4000 (-> 8000)
        clock.tick(4000); //         dial #4 @ t=7000  -> retry in 8000 (capped, stays 8000)
        clock.tick(8000); //         dial #5 @ t=15000 -> retry in 8000 (capped)
        clock.tick(8000); //         dial #6 @ t=23000
        manager.stop();

        // deltas: 1000, 2000, 4000, 8000, 8000 -> doubling then capped at maxReconnectDelay
        dialAt.should.eql([0, 1000, 3000, 7000, 15000, 23000]);
    });

    it("RC-MGR-2 retries at a FIXED delay while endpoints are not ready and does not inflate the backoff", () => {
        clock = sinon.useFakeTimers();

        const dialAttemptAt: number[] = [];
        let ready = false;

        // once ready, the (real) dial itself fails so we can observe the FIRST genuine backoff delay
        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null) => void) => {
            cb(new Error("dial failed"));
            return undefined;
        }) as unknown as CreateReverseConnection);

        const context: ReverseConnectManagerContext = {
            getDialEndpoint: () => {
                dialAttemptAt.push(Date.now());
                return ready ? endpoint : undefined;
            },
            getServerUri: () => "urn:test:Server",
            getEndpointUrl: () => "opc.tcp://server:1/UA"
        };

        const manager = new ReverseConnectManager(context, {
            connections: [{ endpointUrl: "opc.tcp://client:1" }],
            reconnectDelay: 1000,
            maxReconnectDelay: 60000
        });

        manager.start(); //   attempt #1 @ t=0    (not ready) -> fixed retry 1000
        clock.tick(1000); //  attempt #2 @ t=1000 (not ready) -> fixed retry 1000
        clock.tick(1000); //  attempt #3 @ t=2000 (not ready) -> fixed retry 1000
        clock.tick(1000); //  attempt #4 @ t=3000 (not ready) -> fixed retry 1000
        ready = true;
        clock.tick(1000); //  attempt #5 @ t=4000 (ready, dial fails) -> genuine backoff delay = currentDelay
        clock.tick(1000); //  attempt #6 @ t=5000 fires ONLY if that backoff delay was reconnectDelay (1000)
        manager.stop();

        // A constant 1000 ms cadence proves: (a) the not-ready path uses a fixed reconnectDelay, and
        // (b) currentDelay was never inflated by the not-ready retries — the first real backoff still
        //     starts at reconnectDelay. With the old bug, currentDelay would have doubled to ~16000 by
        //     attempt #5 and attempt #6 would land at t=20000, not t=5000.
        dialAttemptAt.should.eql([0, 1000, 2000, 3000, 4000, 5000]);
    });

    it("RC-MGR-3 re-dials after a channel abort, using the reset (reconnectDelay) backoff after a success", () => {
        clock = sinon.useFakeTimers();

        let dialCount = 0;
        const channels: EventEmitter[] = [];
        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null, channel?: unknown) => void) => {
            dialCount += 1;
            const channel = new EventEmitter();
            channels.push(channel);
            cb(null, channel);
            return undefined;
        }) as unknown as CreateReverseConnection);

        const manager = new ReverseConnectManager(
            makeContext(() => endpoint),
            {
                connections: [{ endpointUrl: "opc.tcp://client:1" }],
                reconnectDelay: 1000,
                maxReconnectDelay: 60000
            }
        );

        manager.start();
        dialCount.should.eql(1); // established on first dial

        clock.tick(100000);
        dialCount.should.eql(1); // a healthy channel is never re-dialed

        channels[0].emit("abort"); // spec: recreate socket + re-send ReverseHello after a delay
        dialCount.should.eql(1); // not immediately — it waits reconnectDelay
        clock.tick(999);
        dialCount.should.eql(1);
        clock.tick(1); // the redial fires at exactly reconnectDelay (1000) -> backoff was reset on success
        dialCount.should.eql(2);

        manager.stop();
    });

    it("RC-MGR-4 stop() removes only the manager's own abort listener, not the endpoint's", () => {
        // Guards the removeListener fix (vs removeAllListeners, which would strip the endpoint's own
        // _unregisterChannel handler). We simulate that handler with a marker listener attached before
        // the channel is handed back, then assert it survives stop().
        const channel = new EventEmitter();
        const endpointOwnAbortListener = () => {
            /* stands in for OPCUAServerEndPoint#_unregisterChannel */
        };
        channel.on("abort", endpointOwnAbortListener);

        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null, channel?: unknown) => void) => {
            cb(null, channel);
            return undefined;
        }) as unknown as CreateReverseConnection);

        const manager = new ReverseConnectManager(
            makeContext(() => endpoint),
            {
                connections: [{ endpointUrl: "opc.tcp://client:1" }],
                reconnectDelay: 1000
            }
        );

        manager.start();
        channel.listenerCount("abort").should.eql(2); // endpoint's own + the manager's redial listener

        manager.stop();
        channel.listenerCount("abort").should.eql(1); // only the manager's listener was removed
        channel.listeners("abort")[0].should.equal(endpointOwnAbortListener);
    });

    it("RC-MGR-5 start() and stop() are idempotent", () => {
        clock = sinon.useFakeTimers();
        let dialCount = 0;
        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null) => void) => {
            dialCount += 1;
            cb(new Error("dial failed"));
            return undefined;
        }) as unknown as CreateReverseConnection);

        const manager = new ReverseConnectManager(
            makeContext(() => endpoint),
            {
                connections: [{ endpointUrl: "opc.tcp://client:1" }],
                reconnectDelay: 1000
            }
        );

        manager.start();
        dialCount.should.eql(1);
        manager.start(); // already running -> must not kick off a second dial loop
        dialCount.should.eql(1);

        manager.stop();
        manager.stop(); // already stopped -> must be a no-op, not throw
    });

    it("RC-MGR-6 a dial that completes after stop() discards (closes) the channel", () => {
        // capture the dial callback so we can invoke it AFTER stop(), simulating a dial that finishes
        // mid-shutdown. The manager must not keep the channel — it must close it.
        let storedCb: ((err: Error | null, channel?: unknown) => void) | undefined;
        const endpoint = fakeEndpoint(((_url: string, _opts: unknown, cb: (err: Error | null, channel?: unknown) => void) => {
            storedCb = cb;
            return { destroy: () => undefined }; // a pending socket the manager tracks
        }) as unknown as CreateReverseConnection);

        const manager = new ReverseConnectManager(
            makeContext(() => endpoint),
            {
                connections: [{ endpointUrl: "opc.tcp://client:1" }],
                reconnectDelay: 1000
            }
        );

        manager.start(); // dial issued; callback captured but not yet invoked
        manager.stop(); // shutting down while the dial is still in flight

        const channel = new EventEmitter();
        let closed = false;
        (channel as unknown as { close: (cb: () => void) => void }).close = (cb: () => void) => {
            closed = true;
            cb();
        };

        should.exist(storedCb);
        storedCb!(null, channel); // the dial "completes" after stop()
        closed.should.eql(true); // the just-established channel must be torn down
    });
});
