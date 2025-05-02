import {
    OPCUAServer,
    OPCUAServerOptions,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAClientOptions,
    EndpointWithUserIdentity,
    UserTokenType,
    ClientSession,
    nodesets,
} from "node-opcua"
import should from "should";




const port = 2025;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue_1442", function (this: any) {
    this.timeout(60* 10 * 1000);

    let server: OPCUAServer;
    before(async () => {
        const serverOptions: OPCUAServerOptions = {
            port,
            nodeset_filename: [nodesets.standard],
            securityPolicies: [SecurityPolicy.None],
            securityModes: [ MessageSecurityMode.None],
            allowAnonymous: false
        };
        // start server
        server = new OPCUAServer(serverOptions);
        await server.initialize();
        await server.start();

    });
    after(async () => {
        await server.shutdown();
    });

    const clientOptions: OPCUAClientOptions = {
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 2,
            initialDelay: 250,
            maxDelay: 500,
        },
    };
    const endpoint: EndpointWithUserIdentity = {
        endpointUrl: `opc.tcp://localhost:${port}`,
        userIdentity: {
            type: UserTokenType.Anonymous
        }
    };

    it("client.createSession: session which cannot be created should not be present in the client", async () => {

        // start client
        const client = OPCUAClient.create(clientOptions);
        try {
            await client.connect(endpoint.endpointUrl);
            let failed = false;
            let session: ClientSession | null = null;
            try {
                // Will always fail, because of invalid authentication.
                // Note: Bug is the same for OPCUAClient.createSession2() method.
                session = await client.createSession(endpoint.userIdentity);
            }
            catch (err) {
                console.log("err:", (err as Error).message)
                failed = true
            }
            finally {
                failed.should.be.true(); // createSession successfully failed 
                should(session).is.null(); // therefore no session should exist as return value
                should(client).have.property('_sessions').with.lengthOf(0); // and not in the client
            }
        }
        finally {
            await client.disconnect();
        }
    });
    it("client.createSession2: session which cannot be created should not be present in the client", async () => {

        // start client
        const client = OPCUAClient.create(clientOptions);
        try {
            await client.connect(endpoint.endpointUrl);
            let failed = false;
            let session: ClientSession | null = null;
            try {
                // Will always fail, because of invalid authentication.
                // Note: Bug is the same for OPCUAClient.createSession2() method.
                session = await client.createSession2(endpoint.userIdentity);
            }
            catch (err) {
                console.log("err:", (err as Error).message)
                failed = true
            }
            finally {
                failed.should.be.true(); // createSession successfully failed 
                should(session).is.null(); // therefore no session should exist as return value
                should(client).have.property('_sessions').with.lengthOf(0); // and not in the client
            }
        }
        finally {
            await client.disconnect();
        }
    })
});