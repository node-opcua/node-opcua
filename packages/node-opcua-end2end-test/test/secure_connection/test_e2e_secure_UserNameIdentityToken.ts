import "should";
import os from "os";
import {
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAClient
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { assertThrow } from "../../test_helpers/assert_throw";

// Synchronous user manager
const userManager = {
    isValidUser(userName: string, password: string) {
        return userName === "username" && password === "p@ssw0rd";
    }
};

// Asynchronous user manager
const userManagerAsync = {
    isValidUserAsync(userName: string, password: string, callback: (err: Error|null, authorized?: boolean) => void) {
        setImmediate(() => {
            const authorized = userName === "username" && password === "p@ssw0rd_@sync";
            callback(null, authorized);
        });
    }
};

async function perform_simple_connection(endpointUrl: string, connectionOption: any, credentials: any) {
    const options = {
        securityMode: connectionOption.securityMode || MessageSecurityMode.None,
        securityPolicy: connectionOption.securityPolicy || SecurityPolicy.None,
        endpointMustExist: connectionOption.endpointMustExist
    };
    const client = OPCUAClient.create(options);
    try {
        await client.connect(endpointUrl);
        const session = await client.createSession(credentials);
        await session.close();
    } finally {
        await client.disconnect();
    }
}

describe("testing Client-Server with UserName/Password identity token", () => {
    let server: any; let endpointUrl: string; const port = 2239;

    before(async () => {
        server = await build_server_with_temperature_device({
            port,
            allowAnonymous: false,
            userManager,
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256]
        });
        endpointUrl = server.getEndpointUrl();
    });
    after(async () => { await server.shutdown(); });

    it("should not anonymously connect when anonymous is forbidden", async () => {
        await assertThrow(async () => {
            await perform_simple_connection(endpointUrl, {}, {});
        }, /Cannot find ANONYMOUS user token policy in end point description|BadUserAccessDenied/);
    });

    it("should fail with invalid credentials (no security)", async () => {
        await assertThrow(async () => {
            await perform_simple_connection(endpointUrl, {}, { userName: "username", password: "***invalid password***" });
        }, /BadUserAccessDenied/);
    });

    it("should succeed with valid credentials (no security)", async () => {
        await perform_simple_connection(endpointUrl, {}, { userName: "username", password: "p@ssw0rd" });
    });

    it("should fail with invalid credentials (Sign,Basic256Sha256)", async () => {
        await assertThrow(async () => {
            await perform_simple_connection(endpointUrl, { securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 }, { userName: "username", password: "***invalid password***" });
        }, /BadUserAccessDenied/);
    });

    it("should succeed with valid credentials (Sign,Basic256Sha256)", async () => {
        await perform_simple_connection(endpointUrl, { securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 }, { userName: "username", password: "p@ssw0rd" });
    });

    it("should succeed with valid credentials - secure connection - 256 bits (Sign,Basic256Sha256)", async () => {
        await perform_simple_connection(endpointUrl, { securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 }, { userName: "username", password: (() => "p@ssw0rd")() });
    });

    it("#158 LOCALHOST url with valid credentials (Sign,Basic256Sha256)", async () => {
        const endpointUrlTruncated = `opc.tcp://${os.hostname()}:${port}`;
        await perform_simple_connection(endpointUrlTruncated, { endpointMustExist: false, securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 }, { userName: "username", password: (() => "p@ssw0rd")() });
    });
});

describe("testing Client-Server with UserName/Password identity token - Async", () => {
    let server: any; let endpointUrl: string; const port = 2239;
    before(async () => {
        server = await build_server_with_temperature_device({
            port,
            allowAnonymous: false,
            userManager: userManagerAsync
        });
        endpointUrl = server.getEndpointUrl();
    });
    after(async () => { await server.shutdown(); });

    it("should succeed with async user manager and valid credentials (Sign,Basic256Sha256)", async () => {
        await perform_simple_connection(endpointUrl, { securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 }, { userName: "username", password: (() => "p@ssw0rd_@sync")() });
    });
});
