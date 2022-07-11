import * as fs from "fs";
import * as path from "path";
import "should";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUAServer } from "node-opcua-server";
import { makeRoles, WellKnownRoles } from "node-opcua-address-space";

import {
    OPCUAClient,
    installAlarmMonitoring,
    uninstallAlarmMonitoring,
    UserNameIdentityToken,
    UserIdentityInfoUserName,
    UserTokenType,
    MessageSecurityMode,
    SecurityPolicy
} from "node-opcua-client";

import { installPushCertificateManagementOnServer } from "../..";
import { createSomeOutdatedCertificate, initializeHelpers } from "../helpers/fake_certificate_authority";

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
async function installOutdatedCertificate(certificateManager: OPCUACertificateManager) {
    const certificateFile = path.join(certificateManager.rootDir, "own/certs/certificate.pem");
    try {
        fs.unlinkSync(certificateFile);
    } catch (err) {
        /** */
    }
    await createSomeOutdatedCertificate(certificateManager.rootDir, certificateManager, certificateFile);
}

async function getFolder(name: string) {
    const _folder = await initializeHelpers(name, 2);
    const fakePKI = path.join(_folder, "FakePKI");
    if (!fs.existsSync(fakePKI)) {
        fs.mkdirSync(fakePKI);
    }
    return fakePKI;
}
async function createServerWithPushCertificate() {
    const fakePKIApp = await getFolder("DD-Application");
    const fakePKIUser = await getFolder("DD-User");

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: fakePKIApp
    });
    await serverCertificateManager.initialize();

    const userCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: fakePKIUser
    });
    await userCertificateManager.initialize();

    const userManager = buildUserManager();

    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        userCertificateManager,
        userManager
    });

    await server.initialize();

    await installOutdatedCertificate(server.userCertificateManager);

    await installPushCertificateManagementOnServer(server);

    return server;
}

describe("Test CertificateExpiredAlarm", function () {
    it("should raise the CertificateExpiredAlarm when the certificate expires", async () => {
        /**  */

        const server = await createServerWithPushCertificate();
        await server.start();
        const endpointUrl = server.getEndpointUrl();

        const fakePKI = await getFolder("EE");
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: fakePKI,
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();

        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });
        await client.clientCertificateManager.initialize();

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
                });

                await new Promise((resolve) => setTimeout(resolve, 1000));
                const alarms = alarmList.alarms();
                uninstallAlarmMonitoring(session);

                return alarms;
            }
        );
        await server.shutdown();

        alarms.length.should.eql(1);
        alarms[0].getField("sourceName")!.value.toString().should.eql("DefaultUserTokenGroup");
        //xx alarms[0].getField("message")!.value.toString().should.match("/.*has expired.*/");
        //xx  alarms[0].getField("eventType")!.value.toString().should.match("/.*CertificateExpirationAlarmType.*/");
    });
});
