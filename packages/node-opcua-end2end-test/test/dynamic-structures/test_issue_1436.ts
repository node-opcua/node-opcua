import path from "path";
import { OpaqueStructure } from "node-opcua-extension-object";
import {
    OPCUAServer,
    OPCUAServerOptions,
    nodesets,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAClientOptions,
    EndpointWithUserIdentity,
    UserTokenType,
    AttributeIds
} from "node-opcua"

const port = 2024; // use a unit port number to allow test serialization
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue_1436", function (this: any) {

    this.timeout(10 * 1000);

    let server: OPCUAServer;
    before(async()=>{
        const fixtureFolder = path.join(__dirname, "../../../node-opcua-address-space/test_helpers/test_fixtures/fixtures-for-1436");
        const serverOptions: OPCUAServerOptions = {
            port,
            nodeset_filename: [
                nodesets.standard,
                path.join(fixtureFolder, "test_issue_1436_base.xml"),
                path.join(fixtureFolder, "test_issue_1436_dependent.xml"),
                path.join(fixtureFolder, "test_issue_1436_server.xml")
            ],
            securityPolicies: [SecurityPolicy.None],
            securityModes: [MessageSecurityMode.None]
        };
        server = new OPCUAServer(serverOptions);
        await server.initialize();
        await server.start();
    });
    after(async()=>{
        await server.shutdown();
    });

  
    it("should correctly handle 1.04 servers when handling structs which depend on multiple namespaces", async () => {


        const clientOptions: OPCUAClientOptions = {
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 2,
                initialDelay: 250,
                maxDelay: 500,
            }
        };
        const endpoint: EndpointWithUserIdentity = {
            endpointUrl: `opc.tcp://localhost:${port}`,
            userIdentity: {
                type: UserTokenType.Anonymous
            }
        }
        // read struct with client
        const client = OPCUAClient.create(clientOptions);
        await client.withSessionAsync(endpoint, async (session) => {
            const result = await session.read({
                nodeId: "ns=4;i=6001", // Read variable of data type structure which contains a structure from a dependent namespace.
                attributeId: AttributeIds.Value,
            })

            if (result.statusCode.isBad() || !result.value.value) {
                throw new Error("Error while reading node.")
            }

            if (result.value.value instanceof OpaqueStructure) {
                throw new Error("Structure with substructure from dependent namespace could not be decoded right.")
            }
        });


    })
});
