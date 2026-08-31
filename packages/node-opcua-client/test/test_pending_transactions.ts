// The pending-transaction queue used to be unreachable: the only push was guarded by
// `if (pendingTransactions.length > 0)`, so nothing could ever seed it. Requests issued while the
// connection was down fell straight through and failed with "Invalid Channel BadConnectionClosed".
//
// They are now held until the session is usable again, and replayed - or failed, if the repair
// gives up. The hold is keyed on the channel being down, not merely on "reconnecting": the repair
// restores the session after the secure channel is back up, so its own traffic (including the
// plain Read that readOperationLimits issues) must not be parked behind the repair.
import "mocha";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { ReadRequest, ReadResponse } from "node-opcua-service-read";
import should from "should";
import sinon from "sinon";
import { ClientSessionImpl } from "../source/private/client_session_impl.js";
import type { IClientBase } from "../source/private/i_private_client.js";

type TransactionImpl = IClientBase["performMessageTransaction"];

interface Harness {
    session: ClientSessionImpl;
    transaction: sinon.SinonSpy;
    setChannelOpened(opened: boolean): void;
}

function makeHarness(): Harness {
    let channelOpened = true;
    const transaction = sinon.spy(((_request, callback) => callback(null, new ReadResponse({}))) as TransactionImpl);
    const client = {
        _secureChannel: { isOpened: () => channelOpened, forceConnectionBreak: sinon.spy() },
        isReconnecting: false,
        performMessageTransaction: transaction
    } as unknown as IClientBase;
    const session = new ClientSessionImpl(client);
    session.authenticationToken = new NodeId();
    return {
        session,
        transaction,
        setChannelOpened(opened: boolean) {
            channelOpened = opened;
        }
    };
}

describe("ClientSessionImpl pending transaction queue", function (this: Mocha.Suite) {
    this.timeout(10 * 1000);

    it("PTQ-1 should hold a transaction issued while the channel is down during a repair", () => {
        const { session, transaction, setChannelOpened } = makeHarness();
        setChannelOpened(false);
        session._reconnecting.reconnecting = true;

        let answered = false;
        session.performMessageTransaction(new ReadRequest({}), () => {
            answered = true;
        });

        transaction.callCount.should.eql(0, "nothing may go out while the channel is down");
        answered.should.eql(false, "the caller must still be waiting, not have failed");
        session._reconnecting.pendingTransactions.length.should.eql(1);
    });

    it("PTQ-2 should let the repair's own traffic through once the channel is back up", () => {
        // the repair restores the session *after* the channel is re-established, so it is still
        // flagged as reconnecting while it issues its restore requests. Parking those would
        // deadlock the repair against itself.
        const { session, transaction, setChannelOpened } = makeHarness();
        setChannelOpened(true);
        session._reconnecting.reconnecting = true;

        let answered = false;
        session.performMessageTransaction(new ReadRequest({}), () => {
            answered = true;
        });

        transaction.callCount.should.eql(1, "repair traffic must not be queued behind the repair");
        answered.should.eql(true);
        session._reconnecting.pendingTransactions.length.should.eql(0);
    });

    it("PTQ-3 should fail fast when the channel is down and no repair is under way", () => {
        const { session, transaction, setChannelOpened } = makeHarness();
        setChannelOpened(false);

        let err: Error | null = null;
        session.performMessageTransaction(new ReadRequest({}), (e) => {
            err = e;
        });

        transaction.callCount.should.eql(0);
        (err === null).should.eql(false, "with nobody repairing, waiting would be unbounded");
        // err is assigned in a callback, which TypeScript cannot see running, so it
        // narrows err to null here. Naming the declared type restores what `!` was doing.
        should((err as Error | null)?.message).match(/Invalid Channel BadConnectionClosed/);
        session._reconnecting.pendingTransactions.length.should.eql(0);
    });

    it("PTQ-4 should replay held transactions when the repair succeeds", () => {
        const { session, transaction, setChannelOpened } = makeHarness();
        setChannelOpened(false);
        session._reconnecting.reconnecting = true;

        const answers: (Error | null)[] = [];
        for (let i = 0; i < 3; i++) {
            session.performMessageTransaction(new ReadRequest({}), (e) => answers.push(e));
        }
        session._reconnecting.pendingTransactions.length.should.eql(3);

        // the repair finished: channel back, session usable
        setChannelOpened(true);
        session._reconnecting.reconnecting = false;
        session.flushPendingTransactions(null);

        transaction.callCount.should.eql(3, "every held transaction must reach the channel");
        answers.length.should.eql(3);
        answers.every((e) => e === null).should.eql(true, "all three must have succeeded");
        session._reconnecting.pendingTransactions.length.should.eql(0);
    });

    it("PTQ-5 should fail held transactions when the repair gives up", () => {
        const { session, transaction, setChannelOpened } = makeHarness();
        setChannelOpened(false);
        session._reconnecting.reconnecting = true;

        const answers: (Error | null)[] = [];
        for (let i = 0; i < 3; i++) {
            session.performMessageTransaction(new ReadRequest({}), (e) => answers.push(e));
        }

        session.flushPendingTransactions(new Error("repair gave up"));

        transaction.callCount.should.eql(0, "nothing may be sent once the repair has failed");
        answers.length.should.eql(3, "no caller may be left waiting");
        answers.every((e) => e !== null).should.eql(true);
        session._reconnecting.pendingTransactions.length.should.eql(0);
    });

    it("PTQ-6 should not strand held transactions when the session is disposed", () => {
        const { session, setChannelOpened } = makeHarness();
        setChannelOpened(false);
        session._reconnecting.reconnecting = true;

        const answers: (Error | null)[] = [];
        session.performMessageTransaction(new ReadRequest({}), (e) => answers.push(e));
        session._reconnecting.pendingTransactions.length.should.eql(1);

        session._closeEventHasBeenEmitted = true;
        session.dispose();

        answers.length.should.eql(1, "dispose must resolve the held caller, not just warn about it");
        (answers[0] === null).should.eql(false);
        session._reconnecting.pendingTransactions.length.should.eql(0);
    });
    it("PTQ-7 should not orphan a transaction answered BadSessionIdInvalid while reconnecting", () => {
        // this used to park the callback on a one-shot session_restored listener, which is
        // emitted only when a repair succeeds - so a repair that gave up stranded the caller.
        const { session, setChannelOpened } = makeHarness();
        const sessionGone = new Error(" serviceResult = BadSessionIdInvalid");
        session._client = {
            ...(session._client as unknown as Record<string, unknown>),
            _secureChannel: { isOpened: () => true, forceConnectionBreak: sinon.spy() },
            isReconnecting: true,
            performMessageTransaction: (_r: unknown, cb: (e: Error | null) => void) => cb(sessionGone)
        } as unknown as IClientBase;
        setChannelOpened(true);
        session._reconnecting.reconnecting = true;

        const answers: (Error | null)[] = [];
        session.performMessageTransaction(new ReadRequest({}), (e) => answers.push(e));

        answers.length.should.eql(0, "the caller waits while the session is being repaired");
        session._reconnecting.pendingTransactions.length.should.eql(1, "it must be held, not parked on a listener");

        // the repair gives up: the caller must be told, not left waiting
        session.flushPendingTransactions(new Error("repair gave up"));
        answers.length.should.eql(1, "a failed repair must resolve the held caller");
        (answers[0] === null).should.eql(false);
    });
});
