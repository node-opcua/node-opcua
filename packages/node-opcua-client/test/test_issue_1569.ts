// Regression test for https://github.com/node-opcua/node-opcua/issues/1569
//
// "keepalive does not detect a network outage when the client reads frequently"
//
// ClientSessionImpl used to refresh `lastResponseReceivedTime` from the performMessageTransaction
// callback unconditionally. When the network cable is unplugged, every pending transaction still
// comes back - with a timeout error and no response - so the timestamp kept moving forward and
// ClientSessionKeepAliveManager never saw a gap large enough to declare a keep-alive failure.
//
// `lastResponseReceivedTime` must only move when the server actually answered.
import "mocha";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { ReadRequest, ReadResponse } from "node-opcua-service-read";
import { StatusCodes } from "node-opcua-status-code";
import "should";
import type { Request, Response } from "node-opcua-secure-channel";
import { ClientSessionImpl } from "../source/private/client_session_impl";
import type { IClientBase } from "../source/private/i_private_client";

type TransactionImpl = (request: Request, callback: (err: Error | null, response?: Response) => void) => void;

function makeSession(transaction: TransactionImpl): ClientSessionImpl {
    const client = {
        _secureChannel: { isOpened: () => true },
        performMessageTransaction: (request: Request, callback: (err: Error | null, response?: Response) => void) =>
            transaction(request, callback)
    } as unknown as IClientBase;

    const session = new ClientSessionImpl(client);
    session.authenticationToken = new NodeId();
    return session;
}

describe("issue #1569 - lastResponseReceivedTime must only reflect genuine server answers", function (this: Mocha.Suite) {
    this.timeout(10 * 1000);

    const epoch = new Date(1, 1, 1970).getTime();

    it("should not update lastResponseReceivedTime when the transaction times out", (done) => {
        const session = makeSession((_request, callback) => callback(new Error("Transaction has timed out")));

        session._performMessageTransaction(new ReadRequest({}), (err) => {
            err!.message.should.match(/timed out/);
            session.lastResponseReceivedTime.getTime().should.eql(epoch);
            done();
        });
    });

    it("should not update lastResponseReceivedTime when the channel is broken", (done) => {
        const session = makeSession((_request, callback) => callback(new Error("BadConnectionClosed")));

        session._performMessageTransaction(new ReadRequest({}), () => {
            session.lastResponseReceivedTime.getTime().should.eql(epoch);
            done();
        });
    });

    it("should update lastResponseReceivedTime when the server answers", (done) => {
        const session = makeSession((_request, callback) => callback(null, new ReadResponse({})));

        session._performMessageTransaction(new ReadRequest({}), (err) => {
            (err === null).should.eql(true);
            session.lastResponseReceivedTime.getTime().should.be.greaterThan(epoch);
            done();
        });
    });

    it("should update lastResponseReceivedTime when the server answers with a ServiceFault", (done) => {
        // a ServiceFault is a genuine answer: the server is alive and must be considered as contacted
        const session = makeSession((_request, callback) =>
            callback(null, new ReadResponse({ responseHeader: { serviceResult: StatusCodes.BadTooManyOperations } }))
        );

        session._performMessageTransaction(new ReadRequest({}), (err) => {
            err!.message.should.match(/BadTooManyOperations/);
            session.lastResponseReceivedTime.getTime().should.be.greaterThan(epoch);
            done();
        });
    });
});
