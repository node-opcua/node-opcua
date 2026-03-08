import fs from "node:fs";
import path from "node:path";
import "should";
import bcrypt from "bcryptjs";
import { makeRoles, WellKnownRoles } from "node-opcua-address-space";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    AttributeIds,
    type ClientAlarm,
    DataType,
    DataValue,
    installAlarmMonitoring,
    MessageSecurityMode,
    makeBrowsePath,
    OPCUAClient,
    SecurityPolicy,
    type UserIdentityInfoUserName,
    UserTokenType,
    uninstallAlarmMonitoring
} from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAServer } from "node-opcua-server";

import { installPushCertificateManagementOnServer } from "../../dist/index.js";
import {
    createCertificateWithEndDate,
    createSomeOutdatedCertificate,
    initializeHelpers
} from "../helpers/fake_certificate_authority.js";

const doDebug = false;
const port = 2909;

const millisecondPerDay = 24 * 60 * 60 * 1000;

const salt = bcrypt.genSaltSync(10);

function buildUserManager() {
    const users = [
        {
            username: "root",
            password: bcrypt.hashSync((() => "secret")(), salt),
            role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin, WellKnownRoles.SecurityAdmin])
        },
        {
            username: "user2",
            password: bcrypt.hashSync((() => "password2")(), salt),
            role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator])
        }
    ];

    const userManager = {
        isValidUser(username: string, password: string) {
            const uIndex = users.findIndex((x) => x.username === username);
            if (uIndex < 0) {
                return false;
            }
            return bcrypt.compareSync(password, users[uIndex].password);
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
    } catch (_err) {
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
    } catch (_err) {
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

describe("Test CertificateExpiredAlarm", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 5 * 60 * 1000));

    let clientCertificateManager: OPCUACertificateManager;
    let serverCertificateManager: OPCUACertificateManager;
    let userCertificateManager: OPCUACertificateManager;
    before(async () => {
        await CertificateManager.disposeAll();

        const fakePKI = await getFolder("EE");
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: fakePKI,
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();

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
    after(async () => {
        // dispose all CertificateManager instances (including those
        // created internally by OPCUAServer / OPCUAClient and any
        // lingering instances from other test suites in this process)
        await CertificateManager.disposeAll();
    });
    async function createClient() {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager,
            clientName: "1 test_certificate_expired_alarm.ts"
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
                userIdentity: {
                    type: UserTokenType.UserName,
                    password: (() => "secret")(),
                    userName: "root"
                } as UserIdentityInfoUserName
            },
            async (session) => {
                const alarmList = await installAlarmMonitoring(session);

                alarmList.on("newAlarm", (_alarm) => {
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
                userIdentity: {
                    type: UserTokenType.UserName,
                    password: (() => "secret")(),
                    userName: "root"
                } as UserIdentityInfoUserName
            },
            async (session) => {
                const a = await session.translateBrowsePath(
                    makeBrowsePath("i=85", "/Server/ServerConfiguration/CertificateGroups/DefaultUserTokenGroup/CertificateExpired")
                );

                if (a.statusCode.isNotGood()) {
                    console.log("cannot file the CertificateExpired node in the server");
                    return;
                }
                const certificateExpired = a.targets?.[0].targetId;
                if (!certificateExpired) {
                    console.log("cannot find the CertificateExpired target node");
                    return;
                }

                const b = await session.translateBrowsePath(makeBrowsePath(certificateExpired, "/ExpirationLimit"));
                if (b.statusCode.isNotGood()) {
                    console.log("cannot file the ExpirationLimit node in the server");
                    return;
                }
                const nodeId = b.targets?.[0].targetId;

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
        alarms[0].getField("sourceName")?.value.toString().should.eql("DefaultUserTokenGroup");
        alarms[0].getField("message")?.value.toString().should.match(messageMatch);
        alarms[0]
            .getField("eventType")
            ?.value.toString()
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
