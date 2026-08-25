// Regression test for https://github.com/node-opcua/node-opcua/issues/1569
//
// "keepalive does not detect a network outage when the client reads frequently"
//
// ClientSessionImpl used to refresh `lastResponseReceivedTime` from the performMessageTransaction
// callback unconditionally. When the network cable is unplugged, every pending transaction still
// comes back - with a timeout error and no response - so the timestamp kept moving forward,
// ClientSessionKeepAliveManager kept taking its "we heard from the server recently" shortcut, and
// the keepalive never declared a failure.
//
// `lastResponseReceivedTime` must move when, and only when, the server actually answered. Note that
// a ServiceFault *is* an answer: the channel turns it into an Error and hangs the decoded fault off
// `err.response` (see process_request_callback), so the response argument alone does not tell the
// two cases apart.
import "mocha";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import type { Response } from "node-opcua-secure-channel";
import { ReadRequest, ReadResponse } from "node-opcua-service-read";
import { ServiceFault } from "node-opcua-service-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import "should";
import sinon from "sinon";
import { ClientSessionKeepAliveManager } from "../source/client_session_keepalive_manager";
import { ClientSessionImpl } from "../source/private/client_session_impl";
import type { IClientBase } from "../source/private/i_private_client";

type TransactionImpl = IClientBase["performMessageTransaction"];

function makeSession(transaction: TransactionImpl, channelIsOpened = true): ClientSessionImpl {
    const client = {
        _secureChannel: { isOpened: () => channelIsOpened, forceConnectionBreak: sinon.spy() },
        performMessageTransaction: transaction
    } as unknown as IClientBase;

    const session = new ClientSessionImpl(client);
    session.authenticationToken = new NodeId();
    return session;
}

/**
 * the shape the secure channel actually delivers for a ServiceFault: an Error carrying the
 * decoded fault, and *no* response argument. Mirrors process_request_callback.
 */
function makeServiceFaultError(statusCode: (typeof StatusCodes)[keyof typeof StatusCodes]): Error {
    const serviceFault = new ServiceFault({ responseHeader: { serviceResult: statusCode } });
    const err = new Error(` serviceResult = ${statusCode.toString()}`) as Error & { response: Response };
    err.response = serviceFault as unknown as Response;
    return err;
}

describe("issue #1569 - lastResponseReceivedTime must only reflect genuine server answers", function (this: Mocha.Suite) {
    this.timeout(10 * 1000);

    interface TestCase {
        what: string;
        transaction: TransactionImpl;
        channelIsOpened?: boolean;
        expectContact: boolean;
        errMatch: RegExp | null;
    }

    const testCases: TestCase[] = [
        {
            what: "the transaction times out",
            transaction: (_request, callback) => callback(new Error("Transaction has timed out")),
            expectContact: false,
            errMatch: /timed out/
        },
        {
            what: "the channel is broken",
            // the real broken-channel path returns before the client is ever called
            transaction: () => {
                throw new Error("performMessageTransaction must not be reached on a broken channel");
            },
            channelIsOpened: false,
            expectContact: false,
            errMatch: /Invalid Channel BadConnectionClosed/
        },
        {
            what: "the server answers",
            transaction: (_request, callback) => callback(null, new ReadResponse({})),
            expectContact: true,
            errMatch: null
        },
        {
            what: "the server answers with a ServiceFault",
            // a ServiceFault is a genuine answer: the server is alive and must count as contacted
            transaction: (_request, callback) => callback(makeServiceFaultError(StatusCodes.BadTooManyOperations)),
            expectContact: true,
            errMatch: /BadTooManyOperations/
        },
        {
            what: "the server answers with a bad serviceResult in a normal response",
            // some servers report an operation-level failure in a regular response rather than
            // as a ServiceFault (see issue #1524); that is an answer too.
            transaction: (_request, callback) =>
                callback(null, new ReadResponse({ responseHeader: { serviceResult: StatusCodes.BadTooManyOperations } })),
            expectContact: true,
            errMatch: /BadTooManyOperations/
        }
    ];

    for (const testCase of testCases) {
        const verb = testCase.expectContact ? "should" : "should not";
        it(`${verb} update lastResponseReceivedTime when ${testCase.what}`, (done) => {
            const session = makeSession(testCase.transaction, testCase.channelIsOpened);
            const before = session.lastResponseReceivedTime.getTime();

            session._performMessageTransaction(new ReadRequest({}), (err) => {
                try {
                    if (testCase.errMatch) {
                        (err === null).should.eql(false, "an error was expected");
                        err!.message.should.match(testCase.errMatch);
                    } else {
                        (err === null).should.eql(true, `no error expected, got ${err?.message}`);
                    }
                    const after = session.lastResponseReceivedTime.getTime();
                    if (testCase.expectContact) {
                        after.should.be.greaterThan(before, "the server answered: contact must be recorded");
                    } else {
                        after.should.eql(before, "the server never answered: contact must not be recorded");
                    }
                    done();
                } catch (e) {
                    done(e as Error);
                }
            });
        });
    }

    it("should let the keepalive manager detect an outage while the client keeps reading", () => {
        // the end-to-end shape of #1569: a client whose reads all time out must still see the
        // keepalive fire and force a reconnection, instead of being starved by the
        // "we heard from the server recently" shortcut.
        const clock = sinon.useFakeTimers();
        try {
            const session = makeSession((_request, callback) => callback(new Error("Transaction has timed out")));
            const forceConnectionBreak = (
                session._client as unknown as { _secureChannel: { forceConnectionBreak: sinon.SinonSpy } }
            )._secureChannel.forceConnectionBreak;
            session.timeout = 10_000;

            // the application keeps reading; every read fails on a transport timeout
            const keepReading = setInterval(() => {
                session._performMessageTransaction(new ReadRequest({}), () => {
                    /* the application ignores the error and reads again */
                });
            }, 50);

            const manager = new ClientSessionKeepAliveManager(session);
            let failureFired = false;
            manager.on("failure", () => {
                failureFired = true;
            });
            manager.start(1000);

            clock.tick(5000);
            clearInterval(keepReading);
            manager.stop();

            failureFired.should.eql(true, "keepalive must report a failure even though the client keeps reading");
            forceConnectionBreak.callCount.should.be.greaterThan(0, "the connection must be force-broken");
        } finally {
            clock.restore();
        }
    });

    it("should keep the keepalive quiet while the server answers with ServiceFaults", () => {
        // the converse: a server that rejects every request is still a server we are in contact
        // with, so the keepalive must not tear the connection down.
        const clock = sinon.useFakeTimers();
        try {
            const session = makeSession((_request, callback) => callback(makeServiceFaultError(StatusCodes.BadTooManyOperations)));
            const forceConnectionBreak = (
                session._client as unknown as { _secureChannel: { forceConnectionBreak: sinon.SinonSpy } }
            )._secureChannel.forceConnectionBreak;
            session.timeout = 10_000;
            // stub the keepalive's own read so that only the application traffic drives the
            // timestamp; the spy then tells us whether the keepalive felt the need to ping at all
            const keepAliveRead = sinon.spy((_nodeToRead: unknown, callback: (err: Error | null, dataValue?: DataValue) => void) =>
                callback(null, new DataValue({ statusCode: StatusCodes.Good }))
            );
            session.read = keepAliveRead as unknown as typeof session.read;

            const keepReading = setInterval(() => {
                session._performMessageTransaction(new ReadRequest({}), () => {
                    /* rejected, but the server is answering */
                });
            }, 50);

            const manager = new ClientSessionKeepAliveManager(session);
            let failureFired = false;
            manager.on("failure", () => {
                failureFired = true;
            });
            manager.start(1000);

            clock.tick(5000);
            clearInterval(keepReading);
            manager.stop();

            failureFired.should.eql(false, "a rejecting server is still a reachable server");
            forceConnectionBreak.callCount.should.eql(0, "the connection must not be force-broken");
            keepAliveRead.callCount.should.eql(
                0,
                "the ServiceFaults already prove contact, so the keepalive must not need to ping"
            );
        } finally {
            clock.restore();
        }
    });
});
