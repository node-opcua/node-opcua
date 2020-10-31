"use strict";
const async = require("async");
const should = require("should");

const {
    BrowseDirection,
    OPCUAClient,
    makeNodeId,
    VariableIds,
    AttributeIds,
    makeBrowsePath,
    StatusCodes,
    ClientMonitoredItemGroup,
    DataType,
    resolveNodeId,
    UserTokenType,
    randomNodeId
} = require("node-opcua");

const sinon = require("sinon");
module.exports = function(test) {

    describe("SDS3 Testing SessionDiagnostics 2/2", function() {

        async function readServerDiagnostics(session) {
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
        let data;
        beforeEach(async () => {
            const client = OPCUAClient.create({ endpoint_must_exist: false });
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

                const client2 = OPCUAClient.create({ endpoint_must_exist: false });
                await client2.connect(test.endpointUrl);
                try {
                    const session2 = await client2.createSession({ type: UserTokenType.UserName, userName: "Invalid" });

                    should.fail();

                } catch (err) {
                    /* */
                    console.log(err.message);
                }
                await client2.disconnect();
            }

            const dataAfter = await readServerDiagnostics(session);

            //xx console.log(dataBefore);
            /// console.log(dataAfter);

            dataAfter.cumulatedSessionCount.should.eql(dataBefore.cumulatedSessionCount + 1, "should stay identical");
            dataAfter.securityRejectedSessionCount.should.eql(dataBefore.securityRejectedSessionCount + 1, "securityRejectedSessionCount should increase");
            dataAfter.rejectedSessionCount.should.eql(dataBefore.rejectedSessionCount + 1, "rejectedSessionCount should increase");

        });
        it("SDS3-B - should not increase securityRejectedSessionCount but increase rejectedSessionCount if session is created with invalid session ID", async () => {

            const { session, client } = data;

            const dataBefore = await readServerDiagnostics(session);

            //  create a session with invalid  userIdentity
            {

                const client2 = OPCUAClient.create({ endpoint_must_exist: false });
                await client2.connect(test.endpointUrl);
                try {
                    await new Promise((resolve, reject) => {
                        client2._createSession((err/*: Error | null*/, session2/*: ClientSession*/) => {

                            const original = session2.authenticationToken;
                            session2.authenticationToken = randomNodeId();
                            client2._activateSession(session2, (err) => {
                                if (err) {

                                    session2.authenticationToken = original;
                                    client2.closeSession(session2, true).then(() => {
                                        return reject(err);
                                    });
                                }
                                resolve();
                            });

                        });
                    });

                    should.fail();

                } catch (err) {
                    /* */
                    // console.log(err.message);
                    // console.log(err);
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