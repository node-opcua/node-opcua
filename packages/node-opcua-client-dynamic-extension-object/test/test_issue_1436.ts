
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
} from "../../node-opcua"

const serverOptions: OPCUAServerOptions = {
    port: 4840,
    nodeset_filename: [
        nodesets.standard,
        "./test/test_issue_1436_base.xml",
        "./test/test_issue_1436_dependent.xml",
        "./test/test_issue_1436_server.xml"
    ],
    securityPolicies: [SecurityPolicy.None],
    securityModes: [MessageSecurityMode.None]
};

const clientOptions: OPCUAClientOptions = {
    endpointMustExist: false,
    connectionStrategy: {
        maxRetry: 2,
        initialDelay: 250,
        maxDelay: 500,
    }
};

const endpoint: EndpointWithUserIdentity = {
    endpointUrl: "opc.tcp://localhost:4840",
    userIdentity: {
        type: UserTokenType.Anonymous
    }
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue_1436", function (this: any) {
    this.timeout(10 * 1000);
    it("should correctly handle 1.04 servers when handling structs which depend on multiple namespaces", async () => {
        const server = new OPCUAServer(serverOptions);
        try {
            // start server
            await server.initialize();
            await server.start();

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

        } finally {
            // shutdown server
            await server.shutdown();
        }
    })
});
