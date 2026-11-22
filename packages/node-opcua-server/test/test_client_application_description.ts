import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import { ApplicationType, MessageSecurityMode, OPCUAClient, SecurityPolicy } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { OPCUAServer, type ServerSession } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

const port = 12147;

// The clientDescription is only visible to the server receiving CreateSession.
describe("OPCUAClient clientDescription in CreateSession", function (this: Mocha.Suite) {
    this.timeout(60000);
    let server: OPCUAServer;
    const created: { session?: ServerSession } = {};
    // read through a function: TypeScript would keep the `delete` narrowing across the awaits
    const createdSession = (): ServerSession | undefined => created.session;

    before(async () => {
        server = new OPCUAServer({
            port,
            serverCertificateManager: await createServerCertificateManager(port),
            nodeset_filename: [get_mini_nodeset_filename()],
            securityPolicies: [SecurityPolicy.None],
            securityModes: [MessageSecurityMode.None]
        });
        await server.start();
        server.on("create_session", (session: ServerSession) => {
            created.session = session;
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    async function announcedDescription(client: OPCUAClient) {
        delete created.session;
        await client.connect(`opc.tcp://localhost:${port}`);
        try {
            const session = await client.createSession();
            await session.close();
        } finally {
            await client.disconnect();
        }
        return createdSession()?.clientDescription;
    }

    it("announces Client and NodeOPCUA-Client by default", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });
        const description = await announcedDescription(client);
        should(description?.applicationType).eql(ApplicationType.Client);
        should(description?.productUri).eql("NodeOPCUA-Client");
    });

    it("announces the configured applicationType and productUri", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            applicationType: ApplicationType.ClientAndServer,
            productUri: "urn:example:gateway"
        });
        should(client.applicationType).eql(ApplicationType.ClientAndServer);
        should(client.productUri).eql("urn:example:gateway");
        const description = await announcedDescription(client);
        should(description?.applicationType).eql(ApplicationType.ClientAndServer);
        should(description?.productUri).eql("urn:example:gateway");
    });

    it("refuses an applicationType a client cannot announce", () => {
        should(() => OPCUAClient.create({ applicationType: ApplicationType.Server as unknown as ApplicationType.Client })).throw(
            /invalid applicationType Server/
        );
    });
});
