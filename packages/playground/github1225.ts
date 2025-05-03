

import {
    OPCUAServer,
    UserTokenType,
    SecurityPolicy,
    OPCUACertificateManager,
    MessageSecurityMode,
    UserIdentityInfo
} from "node-opcua";
import {
    OPCUAClient,
} from "node-opcua";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
    });
    const server = new OPCUAServer({
        serverCertificateManager,
        userManager: {
            isValidUser(username: string, password: string) {
                return true;
            }
        },
         allowAnonymous: false,
        securityPolicies: [
            SecurityPolicy.Basic256Sha256
        ],
        securityModes: [
            MessageSecurityMode.Sign,
            MessageSecurityMode.SignAndEncrypt,
        ]
    });

    await server.initialize();

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());

})();

const endpointUrl = "opc.tcp://localhost:26543";

async function testConnection(
    { securityPolicy, securityMode, userIdentity, expected }
        : {
            securityPolicy: SecurityPolicy,
            securityMode: MessageSecurityMode,
            userIdentity: UserIdentityInfo,
            expected: boolean
        }
): Promise<boolean> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode,
        securityPolicy,
    });
    client.on("backoff", () => console.log("keep trying to connect"));

    let result = false;
    try {
        result =  await client.withSessionAsync(
            {
                endpointUrl,
                userIdentity
            },

            async (session) => {
                return true;
            });
    } catch (err) {
        result= false;
    }
    const offset = "http://opcfoundation.org/UA/SecurityPolicy".length +1;
    console.log(`${UserTokenType[userIdentity.type].padEnd(10)} ${MessageSecurityMode[securityMode].padEnd(9)} ${securityPolicy.substring(offset).padEnd(12)} expected ${expected}, is ${result} `)
    return result == expected;
}
(async () => {

    var r1= await testConnection({ 
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        userIdentity: { type: UserTokenType.Anonymous },
        expected: false,
    });
    var r2 = await testConnection({
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        userIdentity: {
            type: UserTokenType.UserName,
            userName: "some-user",
            password: "whatever"
        },
        expected: false,
    });
    var r3 = await testConnection({
        securityMode: MessageSecurityMode.Sign,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        userIdentity: { type: UserTokenType.Anonymous },
        expected: false,
    });
    var r4 = await testConnection({
        securityMode: MessageSecurityMode.Sign,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        userIdentity: {
            type: UserTokenType.UserName,
            userName: "some-user",
            password: "whatever"
        },
        expected: true,
    });

    console.log({r1,r2,r3,r4});
})();
