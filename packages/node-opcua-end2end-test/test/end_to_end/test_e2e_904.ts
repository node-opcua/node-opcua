import {
    CreateSessionResponse,
    get_mini_nodeset_filename,
    nodesets,
    OPCUAClient,
    OPCUAServer,
    UserIdentityInfo,
    UserTokenType,
    Response,
    Request
} from "node-opcua";
import * as should from "should";
const port = 2008;
const doDebug = false;

function geEndpoint(server: OPCUAServer): string {
    return server.getEndpointUrl()!;
}

let serverNonce: undefined | null | Buffer;

async function startServer(): Promise<OPCUAServer> {
    // get IP of the machine
    const mini = get_mini_nodeset_filename();

    const server = new OPCUAServer({
        port,
        // nodeset_filename: [nodesets.standard],
        nodeset_filename: [mini],
        userManager: {
            isValidUser(userName: string, password: string): boolean {
                if (userName === "test" && password === "test") {
                    return true;
                }
                return false;
            }
        }
    });
    server.on("response", (response: Response) => {
        if (response instanceof CreateSessionResponse) {
            if (serverNonce === undefined) {
                return;
            }
            // let's tweak the serverNonce !!!
            // to emulate  Schneider Electric PLC - M580 behavior
            (response as any).serverNonce = serverNonce;
        }
    });
    await server.initialize();
    await server.start();
    if (doDebug) {
        console.log(`server started ${port}`);
    }
    return server;
}
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#904 - Client should connect to server that do not provide ServerNonce", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    let client: OPCUAClient;

    let serverNonceWasNullOrEmptyBuffer: undefined | boolean = undefined;
    beforeEach(async () => {
        serverNonceWasNullOrEmptyBuffer = undefined;
        client = OPCUAClient.create({ endpointMustExist: false });
        client.on("backoff", () => console.log("keep trying", endpointUri));

        const endpointUri = geEndpoint(server);
        if (doDebug) {
            console.log("endpoint = ", endpointUri);
        }
        client.on("send_request", (request: Request) => {});
        client.on("receive_response", (response: Response) => {
            if (response instanceof CreateSessionResponse) {
                serverNonceWasNullOrEmptyBuffer = response.serverNonce === null || response.serverNonce.length === 0;
            }
        });

        await client.connect(endpointUri);
    });
    afterEach(async () => {
        await client.disconnect();
    });

    async function testCreateSessionShouldSucceed(userIdentityInfo: UserIdentityInfo) {
        try {
            const session = await client.createSession(userIdentityInfo);
            if (doDebug) {
                console.log("Session created !");
            }
            await session.close();
        } catch (err) {
            // createSession is not supposed to raise an exception
            throw err;
        } finally {
            if (serverNonce !== undefined) {
                should.exist(serverNonceWasNullOrEmptyBuffer, " should have received a CreateSessionResponse");
                serverNonceWasNullOrEmptyBuffer!.should.eql(true, "we are expecting server to return and empty server Nonce");
            }
        }
    }

    async function testCreateSessionShouldFail(userIdentityInfo: UserIdentityInfo) {
        async function func() {
            const session = await client.createSession(userIdentityInfo);
            if (doDebug) {
                console.log("Session created ! - Not expected !");
            }
            await session.close();
        }

        let exceptionCaught = false;
        try {
            await func();
        } catch (err) {
            // we are expecting this exception here!
            if (doDebug && err instanceof Error) {
                console.log(err.message);
            }
            exceptionCaught = true;
        }

        exceptionCaught.should.eql(true, " createSession must have failed");
        if (serverNonce !== undefined) {
            should.exist(serverNonceWasNullOrEmptyBuffer, " should have received a CreateSessionResponse");
            serverNonceWasNullOrEmptyBuffer!.should.eql(true, "we are expecting server to return and empty server Nonce");
        }
    }
    it("#904-1 Client should allow unsecure connection with anonymous user when serverNonce is specified ", async () => {
        serverNonce = undefined; // use default behavior
        await testCreateSessionShouldSucceed({
            type: UserTokenType.Anonymous
        });
    });
    it("#904-1 Client should allow unsecure connection with anonymous user when  serverNonce==null ", async () => {
        serverNonce = null;
        await testCreateSessionShouldSucceed({
            type: UserTokenType.Anonymous
        });
    });
    it("#904-2 Client should allow unsecure connection with anonymous user when serverNonce is a null Buffer", async () => {
        serverNonce = Buffer.alloc(0);
        await testCreateSessionShouldSucceed({
            type: UserTokenType.Anonymous
        });
    });
    //------------------------------------------

    const userIdentity: UserIdentityInfo = {
        type: UserTokenType.UserName,
        password: "test",
        userName: "test"
    };
    it("#904-3 Client should NOT allow unsecure connection when userName Identity is when serverNonce = null (because password would be sent un-encrypted)", async () => {
        serverNonce = null;
        await testCreateSessionShouldFail(userIdentity);
    });
    it("#904-4 Client should NOT allow unsecure connection when userName Identity is when serverNonce = emptyBuffer (because password would be sent un-encrypted)", async () => {
        serverNonce = Buffer.alloc(0);
        await testCreateSessionShouldFail(userIdentity);
    });

    it("#904-5 Client should allow unsecure connection with userName Identity  when serverNonce is specified ", async () => {
        serverNonce = undefined; // use default behavior
        await testCreateSessionShouldSucceed(userIdentity);
    });
});
