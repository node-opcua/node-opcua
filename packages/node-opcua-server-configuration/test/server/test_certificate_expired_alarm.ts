import * as fs from "fs";
import * as path from "path";
import "should";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUAServer } from "node-opcua-server";
import { makeRoles, SessionContext, WellKnownRoles } from "node-opcua-address-space";
import { PseudoSession } from "node-opcua-address-space";
import {
    OPCUAClient,
    installAlarmMonitoring,
    uninstallAlarmMonitoring,
    UserNameIdentityToken,
    UserIdentityInfoUserName,
    makeBrowsePath,
    UserTokenType,
    MessageSecurityMode,
    ClientAlarm,
    SecurityPolicy,
    DataValue,
    DataType,
    AttributeIds,
    StatusCodes,
    NodeId
} from "node-opcua-client";
import { MockContinuationPointManager } from "node-opcua-address-space/test_helpers";

import { installPushCertificateManagementOnServer } from "../..";
import {
    createSomeOutdatedCertificate,
    createCertificateWithEndDate,
    initializeHelpers
} from "../helpers/fake_certificate_authority";

const doDebug = false;
const port = 2909;

const millisecondPerDay = 24 * 60 * 60 * 1000;

function buildUserManager() {
    const users = [
        {
            username: "root",
            password: "secret",
            role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin, WellKnownRoles.SecurityAdmin])
        },
        { username: "user2", password: "password2", role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) }
    ];

    const userManager = {
        isValidUser(username: string, password: string) {
            const uIndex = users.findIndex((x) => x.username === username);
            if (uIndex < 0) {
                return false;
            }
            if (users[uIndex].password !== password) {
                return false;
            }
            return true;
        },
        getUserRoles(username: string) {
            const uIndex = users.findIndex((x) => x.username === username);
            if (uIndex < 0) {
                return [];
            }
            const userRole = users[uIndex].role;
            return userRole;
        }
    };
    return userManager;
}

async function installSoonOutdateedCertificate(certificateManager: OPCUACertificateManager) {
    console.log("installSoonOutdateedCertificate: start");
    const certificateFile = path.join(certificateManager.rootDir, "own/certs/certificate.pem");
    try {
        fs.unlinkSync(certificateFile);
    } catch (err) {
        /** */
    }
    // expiring in 10 days
    const endDate = new Date(Date.now() + millisecondPerDay * 10);
    await createCertificateWithEndDate(certificateManager.rootDir, certificateManager, certificateFile, endDate, 365);
    console.log("installSoonOutdateedCertificate: done");
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
async function installOutdatedCertificate(certificateManager: OPCUACertificateManager) {
    console.log("installOutdatedCertificate: start");
    const certificateFile = path.join(certificateManager.rootDir, "own/certs/certificate.pem");
    try {
        fs.unlinkSync(certificateFile);
    } catch (err) {
        /** */
    }
    await createSomeOutdatedCertificate(certificateManager.rootDir, certificateManager, certificateFile);
    console.log("installOutdatedCertificate: done");
}

async function getFolder(name: string) {
    const _folder = await initializeHelpers(name, 2);
    const fakePKI = path.join(_folder, "FakePKI");
    if (!fs.existsSync(fakePKI)) {
        fs.mkdirSync(fakePKI);
    }
    return fakePKI;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Test CertificateExpiredAlarm", function () {
    let clientCertificateManager: OPCUACertificateManager;
    let serverCertificateManager: OPCUACertificateManager;
    let userCertificateManager: OPCUACertificateManager;

    before(async () => {
        const fakePKI = await getFolder("EE");
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: fakePKI,
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();
    });
    before(async () => {
        const fakePKIApp = await getFolder("DD-Application");
        const fakePKIUser = await getFolder("DD-User");

        serverCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: fakePKIApp
        });
        await serverCertificateManager.initialize();

        userCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: fakePKIUser
        });
        await userCertificateManager.initialize();
    });
    async function createClient() {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });
        await client.clientCertificateManager.initialize();
        return client;
    }

    async function createServerWithPushCertificate() {
        const userManager = buildUserManager();

        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            userCertificateManager,
            userManager
        });

        await server.initialize();
        await installPushCertificateManagementOnServer(server);
        await server.start();
        return server;
    }

    async function extractAlarms(endpointUrl: string): Promise<ClientAlarm[]> {
        const client = await createClient();
        const alarms = await client.withSessionAsync(
            {
                endpointUrl,
                userIdentity: <UserIdentityInfoUserName>{
                    type: UserTokenType.UserName,
                    password: "secret",
                    userName: "root"
                }
            },
            async (session) => {
                const alarmList = await installAlarmMonitoring(session);

                alarmList.on("newAlarm", (alarm) => {
                    /** */
                });
                alarmList.on("alarmChanged", (alarm) => {
                    /** */
                    doDebug && console.log(alarm.toString());
                });

                await new Promise((resolve) => setTimeout(resolve, 1000));
                const alarms = alarmList.alarms();
                await uninstallAlarmMonitoring(session);

                return alarms;
            }
        );
        return alarms;
    }
    async function changeCertificateAlarmExpirationTime(server: OPCUAServer, limitInMilliseconds: number) {
        // const contextSecuritySignAndEncrypt = new SessionContext({
        //     server,
        //     session: {
        //         getSessionId() {
        //             return NodeId.nullNodeId;
        //         },
        //         userIdentityToken: new UserNameIdentityToken({
        //             userName: "admin"
        //         }),
        //         continuationPointManager: new MockContinuationPointManager(),
        //         channel: {
        //             securityMode: MessageSecurityMode.SignAndEncrypt,
        //             securityPolicy: "",
        //             clientCertificate: null
        //         }
        //     }
        // });
        // const session = new PseudoSession(server.engine.addressSpace!, contextSecuritySignAndEncrypt);

        const client = await createClient();
        const endpointUrl = server.getEndpointUrl();
        await client.withSessionAsync(
            {
                endpointUrl,
                userIdentity: <UserIdentityInfoUserName>{
                    type: UserTokenType.UserName,
                    password: "secret",
                    userName: "root"
                }
            },
            async (session) => {
                const a = await session.translateBrowsePath(
                    makeBrowsePath("i=85", "/Server/ServerConfiguration/CertificateGroups/DefaultUserTokenGroup/CertificateExpired")
                );

                if (a.statusCode !== StatusCodes.Good) {
                    console.log("cannot file the CertificateExpired node in the server");
                    return;
                }

                const certificateExpired = a.targets![0].targetId;

                const b = await session.translateBrowsePath(makeBrowsePath(certificateExpired, "/ExpirationLimit"));
                if (b.statusCode !== StatusCodes.Good) {
                    console.log("cannot file the ExpirationLimit node in the server");
                    return;
                }
                const nodeId = b.targets![0].targetId;

                console.log(" changing the ExpirationLimit node to ", limitInMilliseconds);
                const dataValue = new DataValue({ value: { dataType: DataType.Double, value: limitInMilliseconds } });
                const statusCode = await session.write({ nodeId, attributeId: AttributeIds.Value, value: dataValue });
                console.log("statusCode", statusCode.toString());
            }
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    function checkAlarmIsCertificateExpirationAlarmForDefaultUserTokenGroup(alarms: ClientAlarm[], messageMatch = /has expired/) {
        alarms.length.should.eql(1);
        alarms[0].getField("sourceName")!.value.toString().should.eql("DefaultUserTokenGroup");
        alarms[0].getField("message")!.value.toString().should.match(messageMatch);
        alarms[0]
            .getField("eventType")!
            .value.toString()
            .should.match(/i=13225/);
    }

    let server: OPCUAServer;
    beforeEach(async () => {
        server = await createServerWithPushCertificate();
    });
    afterEach(async () => {
        await server.shutdown();
    });

    it("CMZ-1 should raise the CertificateExpiredAlarm when the certificate expires", async () => {
        const endpointUrl = server.getEndpointUrl();

        // Given a outdated certificate on the server
        await installOutdatedCertificate(server.userCertificateManager);

        // When I get the active alarms
        const alarms = await extractAlarms(endpointUrl);
        alarms.length.should.eql(1);

        // Then I should have a CertificateExpiredAlarm
        checkAlarmIsCertificateExpirationAlarmForDefaultUserTokenGroup(alarms);
    });

    it("CMZ-2 should raise the CertificateExpiredAlarm when the certificate expires", async () => {
        const endpointUrl = server.getEndpointUrl();

        // the alarms
        const alarms1 = await extractAlarms(endpointUrl);
        alarms1.length.should.eql(1);

        // Given a outdated certificate on the server
        await installOutdatedCertificate(server.userCertificateManager);

        const alarms2 = await extractAlarms(endpointUrl);
        alarms2.length.should.eql(1);
        checkAlarmIsCertificateExpirationAlarmForDefaultUserTokenGroup(alarms2, /has expired/);

        // Given a almost outdate certificate on the server
        await installSoonOutdateedCertificate(server.userCertificateManager);
        const alarms3 = await extractAlarms(endpointUrl);
        alarms3.length.should.eql(0);

        // change expirying to 15 days
        await changeCertificateAlarmExpirationTime(server, 15 * millisecondPerDay);

        const alarms4 = await extractAlarms(endpointUrl);
        checkAlarmIsCertificateExpirationAlarmForDefaultUserTokenGroup(alarms4, /is about to expire/);

        // changing the expiration limit back to 0
        await changeCertificateAlarmExpirationTime(server, 0 * millisecondPerDay);
        const alarms5 = await extractAlarms(endpointUrl);
        alarms5.length.should.eql(0);
    });
});
