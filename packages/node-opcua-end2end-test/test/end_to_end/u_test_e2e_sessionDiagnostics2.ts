import should from "should";
import {
    OPCUAClient,
    makeNodeId,
    VariableIds,
    AttributeIds,
    UserTokenType,
    randomNodeId,
    ClientSession,
    UserIdentityInfo
} from "node-opcua";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const doDebug = checkDebugFlag("TEST");
const debugLog = make_debugLog("TEST");

export function t(test: any) {

    describe("SDS3 Testing SessionDiagnostics 2/2", function () {

        async function readServerDiagnostics(session: ClientSession) {
            const nodesToRead = [
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary),
                    attributeId: AttributeIds.Value
                },
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount),
                    attributeId: AttributeIds.Value
                },
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount),
                    attributeId: AttributeIds.Value
                },
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount),
                    attributeId: AttributeIds.Value
                },
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_SecurityRejectedSessionCount),
                    attributeId: AttributeIds.Value
                },
                {
                    nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_RejectedSessionCount),
                    attributeId: AttributeIds.Value
                },
            ];
            const dataValues = await session.read(nodesToRead);
            return {
                serverDiagnostics: dataValues[0].value.value,
                cumulatedSessionCount: dataValues[1].value.value,
                currentSessionCount: dataValues[2].value.value,
                rejectedSessionCount: dataValues[5].value.value,
                securityRejectedSessionCount: dataValues[4].value.value,
                currentSubscriptionCount: dataValues[3].value.value,
            };
        }
        let data: any;
        beforeEach(async () => {
            const client = OPCUAClient.create({ endpointMustExist: false });
            await client.connect(test.endpointUrl);
            const session = await client.createSession();
            data = { client, session };
        });
        afterEach(async () => {
            const { session, client } = data;
            await session.close();
            await client.disconnect();
        });

        it("SDS3-A - should increase securityRejectedSessionCount and rejectedSessionCount if session is created with invalid credential", async () => {

            const { session, client } = data;

            const dataBefore = await readServerDiagnostics(session);

            //  create a session with invalid  userIdentity
            {

                const client2 = OPCUAClient.create({ endpointMustExist: false });
                await client2.connect(test.endpointUrl);
                try {
                    const session2 = await client2.createSession({
                        type: UserTokenType.UserName,
                        userName: "Invalid",
                        password: "Invalid Too"
                    });

                } catch (err) {
                    doDebug && debugLog((err as Error).message);
                } finally {
                    await client2.disconnect();
                }
            }

            const dataAfter = await readServerDiagnostics(session);

            //xx console.log(dataBefore);
            /// console.log(dataAfter);

            dataAfter.cumulatedSessionCount.should.eql(dataBefore.cumulatedSessionCount + 1, "should stay identical");
            dataAfter.securityRejectedSessionCount.should.eql(dataBefore.securityRejectedSessionCount + 1, "securityRejectedSessionCount should increase");
            dataAfter.rejectedSessionCount.should.eql(dataBefore.rejectedSessionCount + 1, "rejectedSessionCount should increase");

        });

        interface OpcuaCientPriv extends OPCUAClient {
            _createSession(callback: (err: Error | null, session?: ClientSession) => void): void;
            _activateSession(
                session: ClientSession,
                userIdentityInfo: UserIdentityInfo,
                callback: (err: Error | null, session?: ClientSession) => void
            ): void;
        }
        it("SDS3-B - should not increase securityRejectedSessionCount but increase rejectedSessionCount if session is created with invalid session ID", async () => {

            const { session, client } = data;

            const dataBefore = await readServerDiagnostics(session);

            //  create a session with an invalid userIdentity
            {

                const client2 = OPCUAClient.create({
                    endpointMustExist: false
                });
                await client2.connect(test.endpointUrl);

                try {
                    await new Promise<void>((resolve, reject) => {


                        (client2 as OpcuaCientPriv)._createSession(
                            (err/*: Error | null*/, session2/*: ClientSession*/) => {
                                if (err) return reject(err);

                                const original = session2!.authenticationToken;
                                session2!.authenticationToken = randomNodeId();

                                const userIdentityInfo = (session2! as any).userIdentityInfo;

                                (client2 as OpcuaCientPriv)._activateSession(session2!, userIdentityInfo, (err) => {
                                    if (err) {
                                        debugLog("--> rejected - as expected A");

                                        session2!.authenticationToken = original;

                                        client2.closeSession(session2!, true).then(() => {
                                            debugLog("--> rejected - as expected B");
                                            return reject(err);
                                        });
                                    } else {
                                        resolve();
                                    }
                                });

                            });
                    });

                    should.fail(0,0);

                } catch (err) {
                    /* */
                    if (doDebug) {
                        debugLog((err as Error).message);
                        debugLog(err);
                    }
                }
                await client2.disconnect();
            }

            const dataAfter = await readServerDiagnostics(session);

            //xx console.log(dataBefore);
            /// console.log(dataAfter);

            // dataAfter.cumulatedSessionCount.should.eql(dataBefore.cumulatedSessionCount + 1, "should stay identical");
            dataAfter.securityRejectedSessionCount.should.eql(dataBefore.securityRejectedSessionCount, "securityRejectedSessionCount should *NOT* increase");
            dataAfter.rejectedSessionCount.should.eql(dataBefore.rejectedSessionCount + 1, "rejectedSessionCount should increase");

        });

    });
}