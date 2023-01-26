"use strict";
const should = require("should");
const { OPCUAClient } = require("node-opcua");

const sessionLiveTime = 20 * 1000;
const doDebug = false;

/**
 * open a opcua connect, create a session , and disconnet, without closing the session
 */
async function create_a_pending_session(endpointUrl) {
    const client1 = OPCUAClient.create({
        requestedSessionTimeout: sessionLiveTime,
        keepPendingSessionsOnDisconnect: true
    });

    await client1.connect(endpointUrl);
    // create a session using client1
    const session = await client1.createSession();

    session.timeout.should.eql(sessionLiveTime);
    if (doDebug) {
        console.log("session  ", session.toString());
    }
    client1.keepPendingSessionsOnDisconnect.should.eql(
        true,
        "we do not want client to close unclosed session on disconnect for us"
    );
    // let not close the session here
    // the_session.close(callback);
    await client1.disconnect();

    return session;
}

async function reactivate_existing_session(endpointUrl, session) {
    const client1 = OPCUAClient.create({});

    await client1.connect(endpointUrl);
    // create a session using client1
    await client1.reactivateSession(session);
    // let not close the session here
    await session.close();
    await client1.disconnect();
    return session;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Client and expired session activation", function () {

        it("XKL1 it should be possible to re activate an active session which has not closed by a previous connection", async () => {
            const endpointUrl = test.endpointUrl;
            const session = await create_a_pending_session(endpointUrl);
            const new_session = await reactivate_existing_session(endpointUrl, session);
            new_session.sessionId.toString().should.eql(session.sessionId.toString());
        });

        it("XKL2 it should NOT be possible to re activate a session not closed by a previous connection that has expired", async () => {
            const endpointUrl = test.endpointUrl;

            const session = await create_a_pending_session(endpointUrl);
            if (doDebug) {
                console.log("Waiting for session to expire on server side ....");
            }
            await new Promise((resolve) => setTimeout(resolve, sessionLiveTime * 2));

            const client1 = OPCUAClient.create({});
            await client1.connect(endpointUrl);

            let err;
            try {
                await client1.reactivateSession(session);
                await session.close();
            } catch (_err) {
                err = _err;
            }
            should.exist(err, "expeciting session reactivation to fail, because it has timedout");
            // let not close the session here, because it failed to reactivate
            await client1.disconnect();
        });
    });
};
