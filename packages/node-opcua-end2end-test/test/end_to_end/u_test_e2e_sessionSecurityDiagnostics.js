"use strict";
const should = require("should");
const sinon = require("sinon");

const { 
    SecurityPolicy,
    OPCUAClient, 
    StatusCodes,
    makeNodeId,
    MessageSecurityMode,
    UserTokenType,
    VariableIds,
    AttributeIds,
    BrowseDirection,
    resolveNodeId,
    makeBrowsePath,
    statusCodes,
} = require("node-opcua");

const { perform_operation_on_subscription_async } = require("../../test_helpers/perform_operation_on_client_session");


const clientOptions = {
    endpointMustExist: false,
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256
};

module.exports = function (test) {

    describe("SDS2 Testing SessionSecurityDiagnostics", function () {

        let connectionPoint = null;
        before(()=> {
            connectionPoint = {
                endpointUrl: test.endpointUrl,
                userIdentity: {
                    type: UserTokenType.UserName,
                    userName: "user1",
                    password: "password1"
                }
            }
        });

        it("SDS2-A server should expose a ServerSecurityDiagnostic object", async () => {

            const client = OPCUAClient.create(clientOptions);
            client.on("backoff",() => { 
                console.log("keep trying to connect "+ connectionPoint.endpointUrl)
            });
            
            // first attempt as Anonymous user
            await client.withSessionAsync(
                { endpointUrl: test.endpointUrl, userIdentity: { type:UserTokenType.Anonymous} },
                async (session) => {

                const nodesToRead = [
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionSecurityDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                ];
                const dataValues = await session.read(nodesToRead);
                
                // ----------------------------------- SessionDiagnosticsArray
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                const sessionDiagnostics = dataValues[0].value.value; 
               
                // ----------------------------------- SessionSecurityDiagnosticsArray
                dataValues[1].statusCode.should.eql(StatusCodes.BadUserAccessDenied); 
                // const sessionSecurityDiagnostics = dataValues[1].value.value;
                // should.exist(sessionSecurityDiagnostics);

                // console.log(sessionSecurityDiagnostics.toString());
            });

            // first attempt as Administrator user
            await client.withSessionAsync(
                connectionPoint,
                async (session) => {

                const nodesToRead = [
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionSecurityDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                ];
                const dataValues = await session.read(nodesToRead);
                
                // ----------------------------------- SessionDiagnosticsArray
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                const sessionDiagnostics = dataValues[0].value.value; 
               
                // ----------------------------------- SessionSecurityDiagnosticsArray
                dataValues[1].statusCode.should.eql(StatusCodes.Good); 
                const sessionSecurityDiagnostics = dataValues[1].value.value;
                should.exist(sessionSecurityDiagnostics);
                // console.log(sessionSecurityDiagnostics.toString());
            });   
        });

        it("SDS2-B server should expose a SessionSecurityDiagnostics per Session", async () => {

            const client = OPCUAClient.create(clientOptions);

            await perform_operation_on_subscription_async(client, connectionPoint, async (session, subscription) => {

                 const nodeToRead = {
                    nodeId: session.sessionId,
                    attributeId: AttributeIds.BrowseName
                };
                const dataValue = await session.read(nodeToRead);

                const browseDesc = {
                    nodeId: session.sessionId,
                    /// referenceTypeId: ,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                };
                const browseResult = await session.browse([browseDesc]);

                const browsePath = [
                    makeBrowsePath(session.sessionId, ".SessionSecurityDiagnostics.AuthenticationMechanism"),
                    makeBrowsePath(session.sessionId, ".SessionSecurityDiagnostics.ClientCertificate"),
                    makeBrowsePath(session.sessionId, ".SessionSecurityDiagnostics.ClientUserIdOfSession"),
                    makeBrowsePath(session.sessionId, ".SessionSecurityDiagnostics"),
                    makeBrowsePath(session.sessionId, ".SessionSecurityDiagnostics.SecurityMode")
                ];

                const browsePathResults = await session.translateBrowsePath(browsePath);
                browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[1].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[2].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[3].statusCode.should.eql(StatusCodes.Good);

                const authenticationMechanismNodeId = browsePathResults[0].targets[0].targetId;
                const currentSessionSecurityDiagnosticNodeId = browsePathResults[3].targets[0].targetId;

                const nodeToRead2 = {
                    nodeId: currentSessionSecurityDiagnosticNodeId,
                    attributeId: AttributeIds.Value
                };
                const dataValue2 = await session.read(nodeToRead2);
                dataValue2.statusCode.should.eql(StatusCodes.Good);
                dataValue2.value.value.constructor.name.should.eql("SessionSecurityDiagnosticsDataType");
                
                // console.log(dataValue2.value.value.toString());

                const itemsToMonitor = [
                    {
                        nodeId: currentSessionSecurityDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: authenticationMechanismNodeId,
                        attributeId: AttributeIds.Value
                    },
                ];
                const options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 10
                };
/*
                monitoredItemGroup = ClientMonitoredItemGroup.create(subscription,itemsToMonitor, options);

                monitoredItemGroupChangeSpy = sinon.spy();
                monitoredItemGroup.on("changed", monitoredItemGroupChangeSpy);
            */
            });
        });

        it("SDS2-C server should expose a SessionSecurityDiagnostics in SessionDiagnosticsSummary.SessionSecurityDiagnosticsArray", async () => {

            const client = OPCUAClient.create({});
            await perform_operation_on_subscription_async(client, test.endpointUrl, async (session, subscription) => {

                //xx console.log("session nodeId = ",session.sessionId);

                let sessionDiagnosticsArrayNodeId = resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
                const serverNodeId =resolveNodeId("Server");
                let sessionDiagnosticsNodeId;

                const browsePath = [
                    makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray"),
                ];

                const browsePathResults = await session.translateBrowsePath(browsePath);
                browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;

                const browseDesc = {
                    nodeId: sessionDiagnosticsArrayNodeId,
                    referenceTypeId: "HasComponent",
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                };
                const browseResult = await session.browse([browseDesc]);
                // enumerate all sessions available
                //xx console.log(browseResult[0].toString());
                sessionDiagnosticsNodeId = browseResult[0].references[0].nodeId;

                // read session diagnostics
                const nodeToRead = {
                    nodeId: sessionDiagnosticsNodeId,
                    attributeId: AttributeIds.Value
                };
                const dataValue = await session.read(nodeToRead);
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(7);
            });

        });

        async function count_number_of_exposed_sessionDiagnostics()/*: Promise<number>*/ {

            let sessionDiagnosticsArrayNodeId = resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
            const serverNodeId =resolveNodeId("Server");

            let sessionDiagnosticsNodeId;
            let nbSessionDiagnostics = -1;
            const client = OPCUAClient.create(clientOptions);
            return await perform_operation_on_subscription_async(client, connectionPoint, async (session, subscription) => {
                //  function get_sessionDiagnosticsArrayNodeId(callback) {
                const browsePath = [
                    makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionSecurityDiagnosticsArray"),
                ];

                const browsePathResults = await session.translateBrowsePath(browsePath);

                //xx console.log(browsePathResults[3].toString());
                browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;

                const browseDesc = {
                    nodeId: sessionDiagnosticsArrayNodeId,
                    referenceTypeId: "HasComponent",
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                };
                const browseResult = await session.browse([browseDesc]);
                // enumerate all sessions available
                //xx console.log(browseResult[0].toString());
                sessionDiagnosticsNodeId = browseResult[0].references[0].nodeId;
                nbSessionDiagnostics = browseResult[0].references.length;
                return nbSessionDiagnostics;
            });
        }


        it("SDS2-D server should remove SessionSecurityDiagnostic when session is closed",async () => {

            let nbSessionDiagnosticsStep2;

            // count_before
            let nbSessionDiagnosticsStep1 = await count_number_of_exposed_sessionDiagnostics();

            //  createSession
            const client = OPCUAClient.create(clientOptions);
            await  perform_operation_on_subscription_async(client, connectionPoint, async (session, subscription) => {
                
                const nbSessionDiagnostic = await count_number_of_exposed_sessionDiagnostics();
                nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnostic-1);

             });
        });

        it("SDS2-E it should not be possible to read sessionSecurityDiagnostics with a unsecure connection", async () => {

            const unsecureClientOption = { }
            const client = OPCUAClient.create(unsecureClientOption);
            await  perform_operation_on_subscription_async(client, connectionPoint, async (session, subscription) => {
                
                const nodesToRead = [
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionSecurityDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                ];
                const dataValues = await session.read(nodesToRead);
 
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                dataValues[1].statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
             });

        });

        it("SDS2-F it should not be possible to read sessionSecurityDiagnostics with a secure connection and non admin user", async () => {

            const client = OPCUAClient.create(clientOptions);
            const anonymous_connectionPoint = {
                endpointUrl: connectionPoint.endpointUrl,
                userIdentity: {
                    type: UserTokenType.Anonymous,
                }
            }

            await  perform_operation_on_subscription_async(client, anonymous_connectionPoint, async (session, subscription) => {
                
                const nodesToRead = [
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionSecurityDiagnosticsArray),
                        attributeId: AttributeIds.Value
                    },
                ];
                const dataValues = await session.read(nodesToRead);
 
                dataValues[0].statusCode.should.eql(StatusCodes.Good);
                dataValues[1].statusCode.should.eql(StatusCodes.BadUserAccessDenied);
             });

        });

    });
};
