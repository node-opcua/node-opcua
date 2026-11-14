import { OPCUAClient, ReadRequest, TimestampsToReturn, UserTokenType } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { assertThrow } from "../../test_helpers/assert_throw.js";
async function performMessageTransaction(client, request) {
    return new Promise((resolve, reject) => {
        client.performMessageTransaction(request, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
}
async function _activateSession(client, session, userIdentityInfo) {
    return new Promise((resolve, reject) => {
        client._activateSession(session, userIdentityInfo, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
async function _createSession(client) {
    return new Promise((resolve, reject) => {
        client._createSession((err, session) => {
            if (err) {
                return reject(err);
            }
            resolve(session);
        });
    });
}
export function t(test) {
    let client;
    describe("SNAC Testing client accessing service before session is activated ", () => {
        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(() => { });
        it("SNAC1- should return BadSessionNotActivated when service is called before session is activated", async () => {
            await client.connect(test.endpointUrl);
            try {
                // create the session (without activating it)
                const session1 = await _createSession(client);
                try {
                    // let verify that it is now possible to send a request on client1's session
                    {
                        const readRequest = new ReadRequest({
                            nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                            maxAge: 0,
                            timestampsToReturn: TimestampsToReturn.Both
                        });
                        readRequest.requestHeader.authenticationToken = session1.authenticationToken;
                        await assertThrow(async () => {
                            await performMessageTransaction(client, readRequest);
                        }, /BadSessionNotActivated/);
                    }
                    // verify the session can no longer be used, because a command has already been sent
                    const userIdentityInfo = { type: UserTokenType.Anonymous };
                    const activateSessionError = await assertThrow(async () => {
                        await _activateSession(client, session1, userIdentityInfo);
                    }, /BadSessionIdInvalid|BadSessionClosed/);
                    should.exist(activateSessionError, "Activate Session should return an error if there has been an attempt to use it before being activated");
                }
                finally {
                    await client.closeSession(session1, true);
                    console.log("disconnecting");
                }
            }
            finally {
                await client.disconnect();
            }
        });
    });
}
//# sourceMappingURL=u_test_e2e_test_accessing_service_before_session_is_activated.js.map