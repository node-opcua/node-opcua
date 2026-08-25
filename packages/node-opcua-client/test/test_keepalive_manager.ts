import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { ReadValueIdOptions } from "node-opcua-service-read";
import { StatusCodes } from "node-opcua-status-code";
import sinon from "sinon";

import { ClientSessionKeepAliveManager } from "../dist/client_session_keepalive_manager";
import type { ClientSessionImpl } from "../dist/private/client_session_impl";

type ReadCallback = (err: Error | null, dataValue?: DataValue) => void;

interface FakeSecureChannel {
    forceConnectionBreak: sinon.SinonSpy;
}

function makeSession(readImpl: (nodeToRead: ReadValueIdOptions, callback: ReadCallback) => void): ClientSessionImpl {
    const client = { _secureChannel: { forceConnectionBreak: sinon.spy() } as FakeSecureChannel };
    return {
        timeout: 10_000,
        isReconnecting: false,
        hasBeenClosed: () => false,
        lastResponseReceivedTime: new Date(0),
        read: (nodeToRead: ReadValueIdOptions, callback: ReadCallback) => readImpl(nodeToRead, callback),
        _client: client
    } as unknown as ClientSessionImpl;
}

function makeServiceFaultError(statusCode: { toString(): string }): Error {
    const err = new Error(`serviceResult = ${statusCode.toString()}`);
    (err as Error & { response: unknown }).response = { responseHeader: { serviceResult: statusCode } };
    return err;
}

describe("ClientSessionKeepAliveManager", function (this: Mocha.Suite) {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });
    afterEach(() => {
        clock.restore();
    });

    it("KAL-1 should emit failure and reconnect when session.read returns a transport error", () => {
        const transportErr = new Error("ECONNRESET");
        const session = makeSession((_n, cb) => cb(transportErr, undefined));
        const terminateSpy = (session._client as unknown as { _secureChannel: FakeSecureChannel })._secureChannel
            .forceConnectionBreak;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => {
            failureFired = true;
        });
        mgr.on("keepalive_failure", () => {
            keepaliveFailureFired = true;
        });

        mgr.start(1000);
        clock.tick(600); // fires the initial ping; read callback is synchronous

        failureFired.should.eql(true, "failure event must fire for transport errors");
        keepaliveFailureFired.should.eql(false, "keepalive_failure must NOT fire for transport errors");
        terminateSpy.callCount.should.be.greaterThan(0, "forceConnectionBreak must be called");
        mgr.stop();
    });

    it("KAL-2 should emit keepalive (not keepalive_failure) when session.read returns BadInvalidTimestamp due to clock skew", () => {
        // BadInvalidTimestamp means the server responded at the OPC UA application layer:
        // the session is alive, only the request timestamp was outside the server tolerance.
        // The keepalive round-trip succeeded — treat it as a successful keepalive.
        const serviceFaultErr = makeServiceFaultError(StatusCodes.BadInvalidTimestamp);
        const session = makeSession((_n, cb) => cb(serviceFaultErr, undefined));
        const terminateSpy = (session._client as unknown as { _secureChannel: FakeSecureChannel })._secureChannel
            .forceConnectionBreak;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => {
            failureFired = true;
        });
        mgr.on("keepalive", () => {
            keepaliveFired = true;
        });
        mgr.on("keepalive_failure", () => {
            keepaliveFailureFired = true;
        });

        mgr.start(1000);
        clock.tick(600);

        keepaliveFired.should.eql(true, "keepalive must fire: BadInvalidTimestamp means session is alive (clock skew)");
        keepaliveFailureFired.should.eql(false, "keepalive_failure must NOT fire: clock skew is not a session failure");
        failureFired.should.eql(false, "failure must NOT fire");
        terminateSpy.callCount.should.eql(0, "forceConnectionBreak must NOT be called for clock skew");
        mgr.stop();
    });

    it("KAL-3 should emit failure and reconnect when session.read returns BadSessionIdInvalid", () => {
        const sessionGoneErr = makeServiceFaultError(StatusCodes.BadSessionIdInvalid);
        const session = makeSession((_n, cb) => cb(sessionGoneErr, undefined));
        const terminateSpy = (session._client as unknown as { _secureChannel: FakeSecureChannel })._secureChannel
            .forceConnectionBreak;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => {
            failureFired = true;
        });
        mgr.on("keepalive_failure", () => {
            keepaliveFailureFired = true;
        });

        mgr.start(1000);
        clock.tick(600);

        failureFired.should.eql(true, "failure must fire when session is gone");
        keepaliveFailureFired.should.eql(false, "keepalive_failure must NOT fire when session is gone");
        terminateSpy.callCount.should.be.greaterThan(0, "forceConnectionBreak must be called when session is gone");
        mgr.stop();
    });

    it("KAL-4 should apply exponential backoff after consecutive ServiceFaults", async () => {
        // Use BadInternalError as a generic ServiceFault that goes through the backoff path.
        // BadInvalidTimestamp has dedicated handling (treated as session-alive, no backoff).
        const serviceFaultErr = makeServiceFaultError(StatusCodes.BadInternalError);
        const session = makeSession((_n, cb) => cb(serviceFaultErr, undefined));

        const mgr = new ClientSessionKeepAliveManager(session);
        const failureTimes: number[] = [];
        mgr.on("keepalive_failure", () => {
            failureTimes.push(clock.Date.now());
        });

        // checkInterval = 1000ms, pingTimeout = 500ms → first ping at t=500
        mgr.start(1000);

        // t=500: first ping, backoff = 1000 * 2^1 = 2000ms → next at t=2500
        await clock.tickAsync(500);
        failureTimes.length.should.eql(1, "first failure at t=500");

        // t=2500: second ping, backoff = 1000 * 2^2 = 4000ms → next at t=6500
        await clock.tickAsync(2000);
        failureTimes.length.should.eql(2, "second failure at t=2500");

        // t=6500: third ping fires
        await clock.tickAsync(4000);
        failureTimes.length.should.eql(3, "third failure at t=6500");

        // only 3 failures in ~6.5s — without backoff at checkInterval=1000ms there would be ~6
        mgr.stop();
    });

    it("KAL-5 should treat BadInvalidTimestamp as a successful keepalive (clock skew must not trigger reconnect)", async () => {
        // Simulate a server with persistent clock skew: every keepalive returns BadInvalidTimestamp.
        // The session is alive — the server responded at the OPC UA application layer.
        // Expected: "keepalive" is emitted, no backoff accumulates, no reconnect ever fires.
        const clockSkewErr = makeServiceFaultError(StatusCodes.BadInvalidTimestamp);
        const session = makeSession((_n, cb) => cb(clockSkewErr, undefined));
        const terminateSpy = (session._client as unknown as { _secureChannel: FakeSecureChannel })._secureChannel
            .forceConnectionBreak;

        const mgr = new ClientSessionKeepAliveManager(session);
        let keepaliveCount = 0;
        let keepaliveFailureCount = 0;
        let failureCount = 0;

        mgr.on("keepalive", () => {
            keepaliveCount++;
        });
        mgr.on("keepalive_failure", () => {
            keepaliveFailureCount++;
        });
        mgr.on("failure", () => {
            failureCount++;
        });

        // checkInterval=1000ms, pingTimeout=500ms → pings at t=500, 1500, 2500, 3500, 4500
        mgr.start(1000);
        await clock.tickAsync(5000);

        keepaliveCount.should.be.greaterThan(0, "keepalive must fire: BadInvalidTimestamp means session is alive");
        keepaliveFailureCount.should.eql(0, "keepalive_failure must NOT fire: clock skew is not a session failure");
        failureCount.should.eql(0, "failure must NOT fire");
        terminateSpy.callCount.should.eql(0, "forceConnectionBreak must never be called for clock skew");
        // Without the fix, backoff would reach 60s cap after a few cycles and only 1 ping
        // would fire in 5000ms. With the fix, pings continue at normal checkInterval rate.
        keepaliveCount.should.be.greaterThanOrEqual(4, "pings must continue at normal rate with no backoff");

        mgr.stop();
    });
    it("KAL-6 should re-check as soon as the quiet period is over, not a whole interval later", async () => {
        // the skip branch used to return a negative delta which the scheduler then subtracted,
        // pushing the next liveness check out to 1.4x checkInterval instead of the residual wait.
        const readSpy = sinon.spy((_n: ReadValueIdOptions, cb: ReadCallback) =>
            cb(null, { statusCode: StatusCodes.Good, value: { value: 0 } } as unknown as DataValue)
        );
        const session = makeSession(readSpy);

        // checkInterval = 1000, pingTimeout = 500
        const mgr = new ClientSessionKeepAliveManager(session);
        mgr.start(1000);

        // the server was heard from at t=400, so at the t=500 check there is nothing to do yet
        session.lastResponseReceivedTime = new Date(400);
        await clock.tickAsync(500);
        readSpy.callCount.should.eql(0, "no ping needed while the last contact is still recent");

        // the quiet period ends at t=900: the manager must come back then, not at t=1900
        await clock.tickAsync(400);
        readSpy.callCount.should.eql(1, "the ping must happen as soon as the quiet period is over");

        mgr.stop();
    });

    it("KAL-7 should keep pinging after _ping_server rejects", async () => {
        // a throw out of the read used to reject the un-caught promise chain, leaving
        // transactionInProgress latched and the timer never re-armed: keepalive dead for good.
        let throwOnce = true;
        const readSpy = sinon.spy((_n: ReadValueIdOptions, cb: ReadCallback) => {
            if (throwOnce) {
                throwOnce = false;
                throw new Error("boom");
            }
            cb(null, { statusCode: StatusCodes.Good, value: { value: 0 } } as unknown as DataValue);
        });
        const session = makeSession(readSpy);

        const mgr = new ClientSessionKeepAliveManager(session);
        mgr.start(1000);

        await clock.tickAsync(500); // first ping throws
        readSpy.callCount.should.eql(1);

        await clock.tickAsync(3000); // the manager must have recovered and kept its cadence
        readSpy.callCount.should.be.greaterThan(1, "keepalive must survive an unexpected throw");

        mgr.stop();
    });
});
