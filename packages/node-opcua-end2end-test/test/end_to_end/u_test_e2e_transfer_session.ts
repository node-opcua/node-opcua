import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
    type ClientSession,
    CloseSessionRequest,
    CreateSubscriptionRequest,
    MessageSecurityMode,
    OPCUAClient,
    type OPCUAServer,
    PublishRequest,
    type PublishResponse,
    ReadRequest,
    type Request,
    SecurityPolicy,
    ServiceFault,
    StatusCodes,
    TimestampsToReturn,
    type UserIdentityInfo,
    UserTokenType
} from "node-opcua";
import type { OPCUAClientImpl } from "node-opcua-client/source/private/opcua_client_impl";
import { readCertificateChain, readCertificateRevocationList } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, `expecting certificate store at ${certificateFolder}`);

async function sendPublishRequest(
    session: ClientSession,
    collectPublishResponse?: (err: Error | null, r?: PublishResponse) => void
) {
    const publishRequest = new PublishRequest({});
    if (collectPublishResponse) {
        perform(session, publishRequest)
            .then((r) => collectPublishResponse(null, r as PublishResponse))
            .catch((err) => collectPublishResponse(err as Error));
        return;
    } else {
        return await perform(session, publishRequest);
    }
}
async function createSubscription(session: ClientSession) {
    const publishingInterval = 1000;
    const createSubscriptionRequest = new CreateSubscriptionRequest({
        requestedPublishingInterval: publishingInterval,
        requestedLifetimeCount: 60,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 6
    });

    return await perform(session, createSubscriptionRequest);
}
async function perform(client1: OPCUAClient | ClientSession, request: Request) {
    try {
        const performTx = (client1 as OPCUAClientImpl).performMessageTransaction;
        // Bind to preserve context natively, satisfying `this` parameter requirements
        const promisified = promisify(performTx).bind(client1 as OPCUAClientImpl);
        const response = await promisified(request as unknown as Parameters<typeof performTx>[0]);
        return response as { responseHeader: { serviceResult: unknown } };
    } catch (err) {
        console.log((err as Error).message);
        throw err;
    }
}

function m(file: string) {
    const p = path.join(certificateFolder, file);
    if (!fs.existsSync(p)) {
        console.error(" cannot find ", p);
    }
    return p;
}
const _createSession = async (client1: OPCUAClient): Promise<ClientSession> => {
    const fn = (client1 as unknown as Record<string, (...args: unknown[]) => unknown>)._createSession.bind(client1);
    return (await (promisify(fn) as (...args: unknown[]) => Promise<unknown>)()) as ClientSession;
};

const _activateSession = async (
    client1: OPCUAClient,
    session1: ClientSession,
    userIdentityInfo: UserIdentityInfo
): Promise<void> => {
    const fn = (client1 as unknown as Record<string, (...args: unknown[]) => unknown>)._activateSession.bind(client1);
    await (promisify(fn) as (...args: unknown[]) => Promise<unknown>)(session1, userIdentityInfo);
};

interface IOPCUAClientInner {
    _sessions: unknown[];
}
export function t(test: { endpointUrl: string; server: OPCUAServer }) {
    describe("testing session  transfer to different channel", function (this: Mocha) {
        it("RQB01 - It should be possible to close a session that has not be activated yet", async () => {
            const client1 = OPCUAClient.create({}) as OPCUAClient & IOPCUAClientInner;
            await client1.connect(test.endpointUrl);
            try {
                test.server.engine.currentSessionCount.should.eql(0);
                // create a session using client1, without activating it
                const session1 = await _createSession(client1);
                // Question: ? Should a inactivated session be accounted for
                //             in the currentSessionCount ?
                test.server.engine.currentSessionCount.should.eql(1);

                // however client shall not record session yet
                client1._sessions.length.should.eql(0);

                // in fact, let make sure that close Session is not harmfull
                await should(client1.closeSession(session1, /* deleteSubscriptions =*/ true)).be.fulfilled(); // (/BadSessionNotActivated/);
                client1._sessions.length.should.eql(0);
                // if treated as a Failure , close session expected to return BadSessionNotActivated
                //if (err) {

                // err.message.match(/BadSessionNotActivated/);
                //}

                test.server.engine.currentSessionCount.should.eql(0);
            } finally {
                await client1.disconnect();
            }
        });

        it("RQB02 - calling CreateSession and CloseSession &  CloseSession again should not throw BadSessionIdInvalid", async () => {
            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            try {
                // create a session using client1, without activating it
                const session1 = await _createSession(client1);

                // now session close do not return error event if session is not activated
                await should(session1.close()).be.fulfilled();

                // now session close do not return error if session is already closed
                await should(session1.close()).be.fulfilled();
                test.server.engine.currentSessionCount.should.eql(0);
            } finally {
                await client1.disconnect();
            }
        });

        it("RQB03 - calling CloseSession without calling CreateSession first", async () => {
            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            try {
                const request = new CloseSessionRequest({
                    deleteSubscriptions: true
                });
                await should(perform(client1, request))
                    .be.rejectedWith(/BadSessionIdInvalid/)
                    .then((err) => {
                        err.response.should.be.instanceOf(ServiceFault);
                        err.message.should.match(/BadSessionIdInvalid/);
                        err.response.responseHeader.serviceResult.should.eql(StatusCodes.BadSessionIdInvalid);
                    });
            } finally {
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });

        it("RQB04 - calling CreateSession,  CloseSession  and CloseSession again", async () => {
            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            try {
                const session1 = await client1.createSession();

                // first call to close session should be OK
                await should(client1.closeSession(session1, /* deleteSubscriptions =*/ true)).not.be.rejected();

                // second call to close session should raise an error
                await should(
                    (async () => {
                        const request = new CloseSessionRequest({
                            deleteSubscriptions: true
                        });
                        return await perform(client1, request);
                    })()
                ).be.rejectedWith(/BadSessionIdInvalid/);
            } finally {
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
            await should(client1.disconnect()).not.be.rejected();
        });

        it("RQB05 - call ActiveSession on a session that has been transferred to a different channel", async () => {
            // this test verifies that the following requirement can be met
            // OpcUA 1.02 part 3 $5.5 Secure Channel Set page 20
            // Once a  Client  has established a  Session  it may wish to access the  Session  from a different
            // SecureChannel. The Client can do this by validating the new  SecureChannel  with the
            // ActivateSession  Service  described in 5.6.3.

            // create a first channel (client1)
            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            try {
                // create a session using client1
                const session1 = await _createSession(client1);

                // activate the session as expected on same channel used to create it
                const userIdentityInfo: UserIdentityInfo = { type: UserTokenType.Anonymous };
                await _activateSession(client1, session1, userIdentityInfo);

                // let verify that it is now possible to send a request on client1's session
                // coerce nodeIds
                const request = new ReadRequest({
                    nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                    maxAge: 0,
                    timestampsToReturn: TimestampsToReturn.Both
                });
                request.requestHeader.authenticationToken = session1.authenticationToken as import("node-opcua").NodeId;

                const response = await should(perform(client1, request)).not.be.rejected();
                should(response?.responseHeader.serviceResult).eql(StatusCodes.Good);

                // create a second channel (client2)
                const client2 = OPCUAClient.create({});
                await client2.connect(test.endpointUrl);
                try {
                    // reactivate session on second channel

                    await client2.reactivateSession(session1);
                    // now that session has been assigned to client 1,
                    // server shall refuse any requests on channel1
                    // coerce nodeIds
                    const request1 = new ReadRequest({
                        nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                        maxAge: 0,
                        timestampsToReturn: TimestampsToReturn.Both
                    });
                    request1.requestHeader.authenticationToken = session1.authenticationToken as import("node-opcua").NodeId;
                    should(perform(client2, request1))
                        .be.rejected()
                        .then((err) => {
                            should.exist(err.response);
                            should.exist(err.request);
                            err.response.should.be.instanceOf(ServiceFault);
                            err.response.responseHeader.serviceResult.should.eql(StatusCodes.BadSecureChannelIdInvalid);
                        });
                    //    } else {
                    //        should.not.exist(err);
                    //        should.exist(response);
                    //        response.should.be.instanceOf(ServiceFault);
                    //        response.responseHeader.serviceResult.should.eql(StatusCodes.BadSecureChannelIdInvalid);
                    // but server shall access request on new channel
                    // coerce nodeIds
                    const request2 = new ReadRequest({
                        nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                        maxAge: 0,
                        timestampsToReturn: TimestampsToReturn.Both
                    });
                    request2.requestHeader.authenticationToken = session1.authenticationToken as import("node-opcua").NodeId;

                    const response2 = await perform(client2, request2);
                    should(response2?.responseHeader.serviceResult).eql(StatusCodes.Good);
                    // terminate
                } finally {
                    await client2.disconnect();
                }
            } finally {
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });

        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
        // if the  SecureChannel  is not same as the one associated with the CreateSession  request.
        it("RQB06 - should reject if the channel used to activate the session for the first time is not the same as the channel used to create the session", async () => {
            const serverWithChannels = test.server as unknown as { getChannels: () => unknown[] };
            const initialChannelCount = serverWithChannels.getChannels().length;
            serverWithChannels.getChannels().length.should.equal(initialChannelCount);
            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            try {
                // create a session using client1
                //   ( without activating it)
                const session1 = await _createSession(client1);
                const serverWithChannels = test.server as unknown as { getChannels: () => unknown[] };
                serverWithChannels.getChannels().length.should.equal(initialChannelCount + 1);
                // create a second channel (client2)

                const client2 = OPCUAClient.create({});
                await client2.connect(test.endpointUrl);

                try {
                    // activate the session created with client1 using client2 !!
                    // this should be detected by server and server shall return an error
                    const serverWithChannels = test.server as unknown as { getChannels: () => unknown[] };
                    serverWithChannels.getChannels().length.should.equal(initialChannelCount + 2);
                    //xx console.log(" ID1 =", client1._secureChannel.channelId);
                    //xx console.log(" ID2 =", client2._secureChannel.channelId);

                    await should(client2.reactivateSession(session1)).be.rejectedWith(/BadSessionNotActivated/);
                } finally {
                    await client2.disconnect();
                }
                // activate the session as expected on same channel used to create it
                // so we can close it properly
                const userIdentityInfo: UserIdentityInfo = { type: UserTokenType.Anonymous };
                await _activateSession(client1, session1, userIdentityInfo).should.not.be.rejected();

                await session1.close();
            } finally {
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });

        // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
        // Subsequent calls to  ActivateSession  may be associated with different SecureChannels.  If this is the
        // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
        // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.
        it("RQB07 -server should raise an error if a existing session is reactivated from a channel that have different certificate than the original channel", async () => {
            const serverCertificate = test.server.getCertificateChain();

            /**
             *  create a first channel (client1) with
             */
            async function createSession1() {
                const certificateFile1 = m("client_cert_2048.pem");
                const privateKeyFile1 = m("client_key_2048.pem");
                console.log(certificateFile1);

                const client1 = OPCUAClient.create({
                    certificateFile: certificateFile1,
                    privateKeyFile: privateKeyFile1,
                    securityMode: MessageSecurityMode.Sign,
                    securityPolicy: SecurityPolicy.Basic256Sha256,
                    serverCertificate: serverCertificate
                });

                const certificateChain = readCertificateChain(certificateFile1);
                const certificate = certificateChain[0];
                await test.server.serverCertificateManager.trustCertificate(certificate);
                const issuerCertificateFile = m("CA/public/cacert.pem");
                const issuerCertificateRevocationListFile = m("CA/crl/revocation_list.der");
                const issuerCertificateChain = readCertificateChain(issuerCertificateFile);
                const issuerCertificate = issuerCertificateChain[0];
                const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
                await test.server.serverCertificateManager.addIssuer(issuerCertificate);
                await test.server.serverCertificateManager.addRevocationList(issuerCrl);

                await client1.connect(test.endpointUrl);
                // create a session using client1
                const session1 = await _createSession(client1);
                // activate the session as expected on same channel used to create it
                const userIdentityInfo: UserIdentityInfo = { type: UserTokenType.Anonymous };
                await _activateSession(client1, session1, userIdentityInfo);
                return { client1, session1 };
            }

            // create a first channel(client1) with
            const { client1, session1 } = await createSession1();

            try {
                // create a second channel (client2)
                // with a different certificate ....
                // creating second channel with different credential

                const certificateFile2 = m("client_cert_3072.pem");
                const privateKeyFile2 = m("client_key_3072.pem");
                // make sure that the certificate ist trusted by the server
                const certificateChain2 = readCertificateChain(certificateFile2);
                const certificate2 = certificateChain2[0];
                await test.server.serverCertificateManager.trustCertificate(certificate2);

                console.log(" creating second channel with different (trusted) certificate");
                const client2 = OPCUAClient.create({
                    certificateFile: certificateFile2,
                    privateKeyFile: privateKeyFile2,
                    securityMode: MessageSecurityMode.Sign,
                    securityPolicy: SecurityPolicy.Aes128_Sha256_RsaOaep,
                    serverCertificate: serverCertificate
                });

                await client2.connect(test.endpointUrl);
                try {
                    // reactivate session on second channel
                    await should(client2.reactivateSession(session1)).be.rejectedWith(/BadNoValidCertificates/);
                } finally {
                    // terminate
                    await client2.disconnect();
                }
            } finally {
                await session1.close();
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });

        // In addition,the Server shall verify that the  Client  supplied a  UserIdentityToken  that is   identical to the token
        // currently associated with the  Session.
        it("RQB08 - server should raise an error if a session is reactivated with different user identity tokens", async () => {
            const user1: UserIdentityInfo = {
                type: UserTokenType.UserName,
                userName: "user1",
                password: (() => "password1")()
            };
            const _user2: UserIdentityInfo = {
                type: UserTokenType.UserName,
                userName: "user2",
                password: (() => "password2")()
            };

            const client1 = OPCUAClient.create({}) as OPCUAClient & IOPCUAClientInner;
            await client1.connect(test.endpointUrl);
            try {
                // create a session using client1
                const session1 = await client1.createSession(user1);

                // when the session is transferred to a different channel
                // create a second channel (client2)
                const client2 = OPCUAClient.create({});
                await client2.connect(test.endpointUrl);
                try {
                    // reactivate session on second channel
                    // alter session1.userIdentityInfo

                    // Scrap
                    (session1 as unknown as { userIdentityInfo: UserIdentityInfo }).userIdentityInfo = {
                        type: UserTokenType.Anonymous
                    };

                    await should(client2.reactivateSession(session1)).rejectedWith(
                        /BadIdentityChangeNotSupported/,
                        "expecting an error here , client2 cannot reactivate session1 with different user identity token"
                    );
                    client1._sessions.indexOf(session1).should.not.equal(-1);
                } finally {
                    await client2.disconnect();
                }
            } finally {
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });
        // Once the Server accepts the new  SecureChannel  it shall reject requests sent via the old  SecureChannel.
        xit("RQB09 - server should reject request send via old channel when session has been transferred to new channel", async () => {});

        // unprocessed pending Requests such as PublishRequest shall be be denied by the server
        // Once the Server accepts the new  SecureChannel  it shall reject requests sent via the old  SecureChannel
        it("RQB10 - server should reject pending requests send to old channel when session has been transferred to new channel", async () => {
            const collectPublishResponse = sinon.spy();

            const client1 = OPCUAClient.create({});
            await client1.connect(test.endpointUrl);
            const session1 = await _createSession(client1);
            // activate the session as expected on same channel used to create it
            const userIdentityInfo: UserIdentityInfo = { type: UserTokenType.Anonymous };
            await _activateSession(client1, session1, userIdentityInfo);
            // creaet a subscription,
            try {
                await createSubscription(session1);

                // when the session is transferred to a different channel
                // create a second channel (client2)
                const client2 = OPCUAClient.create({});
                await client2.connect(test.endpointUrl);
                try {
                    collectPublishResponse.callCount.should.eql(0);

                    // provision 3 publish requests and wait for the first keep alive

                    await sendPublishRequest(session1);
                    collectPublishResponse.callCount.should.eql(0);

                    sendPublishRequest(session1, collectPublishResponse);
                    collectPublishResponse.callCount.should.eql(0);
                    sendPublishRequest(session1, collectPublishResponse);
                    collectPublishResponse.callCount.should.eql(0);

                    // reactivate session on second channel
                    await client2.reactivateSession(session1);

                    await new Promise((resolve) => setTimeout(resolve, 100));
                    collectPublishResponse.callCount.should.eql(2);
                    collectPublishResponse.getCall(0).args[0].message.should.match(/BadSecureChannelClosed/);
                    collectPublishResponse.getCall(1).args[0].message.should.match(/BadSecureChannelClosed/);
                } finally {
                    await client2.disconnect();
                }
            } finally {
                await session1.close(true);
                await client1.disconnect();
            }
            test.server.engine.currentSessionCount.should.eql(0);
        });
    });
}
