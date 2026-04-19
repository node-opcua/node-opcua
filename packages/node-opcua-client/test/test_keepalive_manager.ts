import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import sinon from "sinon";

import { ClientSessionKeepAliveManager } from "../dist/client_session_keepalive_manager";
import type { ClientSessionImpl } from "../dist/private/client_session_impl";

function makeSession(readImpl: (nodeToRead: any, callback: any) => void): ClientSessionImpl {
    const client = { _secureChannel: { forceConnectionBreak: sinon.spy() } };
    return {
        timeout: 10_000,
        isReconnecting: false,
        hasBeenClosed: () => false,
        lastResponseReceivedTime: new Date(0),
        read: (_nodeToRead: any, callback: any) => readImpl(_nodeToRead, callback),
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
        const terminateSpy = (session._client as any)._secureChannel.forceConnectionBreak as sinon.SinonSpy;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => { failureFired = true; });
        mgr.on("keepalive_failure", () => { keepaliveFailureFired = true; });

        mgr.start(1000);
        clock.tick(600); // fires the initial ping; read callback is synchronous

        failureFired.should.eql(true, "failure event must fire for transport errors");
        keepaliveFailureFired.should.eql(false, "keepalive_failure must NOT fire for transport errors");
        terminateSpy.callCount.should.be.greaterThan(0, "forceConnectionBreak must be called");
        mgr.stop();
    });

    it("KAL-2 should emit keepalive_failure (not failure) when session.read returns a generic ServiceFault", () => {
        const serviceFaultErr = makeServiceFaultError(StatusCodes.BadInvalidTimestamp);
        const session = makeSession((_n, cb) => cb(serviceFaultErr, undefined));
        const terminateSpy = (session._client as any)._secureChannel.forceConnectionBreak as sinon.SinonSpy;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => { failureFired = true; });
        mgr.on("keepalive_failure", () => { keepaliveFailureFired = true; });

        mgr.start(1000);
        clock.tick(600);

        keepaliveFailureFired.should.eql(true, "keepalive_failure event must fire for ServiceFault");
        failureFired.should.eql(false, "failure must NOT fire for a recoverable ServiceFault");
        terminateSpy.callCount.should.eql(0, "forceConnectionBreak must NOT be called for a recoverable ServiceFault");
        mgr.stop();
    });

    it("KAL-3 should emit failure and reconnect when session.read returns BadSessionIdInvalid", () => {
        const sessionGoneErr = makeServiceFaultError(StatusCodes.BadSessionIdInvalid);
        const session = makeSession((_n, cb) => cb(sessionGoneErr, undefined));
        const terminateSpy = (session._client as any)._secureChannel.forceConnectionBreak as sinon.SinonSpy;

        const mgr = new ClientSessionKeepAliveManager(session);
        let failureFired = false;
        let keepaliveFailureFired = false;
        mgr.on("failure", () => { failureFired = true; });
        mgr.on("keepalive_failure", () => { keepaliveFailureFired = true; });

        mgr.start(1000);
        clock.tick(600);

        failureFired.should.eql(true, "failure must fire when session is gone");
        keepaliveFailureFired.should.eql(false, "keepalive_failure must NOT fire when session is gone");
        terminateSpy.callCount.should.be.greaterThan(0, "forceConnectionBreak must be called when session is gone");
        mgr.stop();
    });
});
