import {
    ActivateSessionRequest,
    OPCUAServer,
    OPCUAClient,
    SecurityPolicy,
    Request,
    MessageSecurityMode,
    AnonymousIdentityToken
} from "node-opcua";
import * as should from "should";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";

const port = 2235;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client that have policyId = null in Activate Session for anonymous connection", () => {
    let server: OPCUAServer;
    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({
            port,
            serverCertificateManager,
            securityPolicies: [SecurityPolicy.None],
            securityModes: [MessageSecurityMode.None]
        });

        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });
    it("a server should not reject a connection if the client has not specified the policyId in ActivateSession", async () => {
        const client = OPCUAClient.create({});

        let policyIdSetToNull = false;
        const original_performMessageTransaction = (client as any).performMessageTransaction;
        (client as any).performMessageTransaction = (request: Request, callback: (error: Error | null) => void) => {
            if (request instanceof ActivateSessionRequest) {
                // console.log(request.toString());
                // reproduce the behavior of Siemens PLC  Un-secure connection
                if (request.userIdentityToken instanceof AnonymousIdentityToken) {
                    request.userIdentityToken.policyId = null;
                    policyIdSetToNull = true;
                }
                // console.log(request.toString());
            }
            original_performMessageTransaction.call(client, request, callback);
        };

        const endpoint = server.getEndpointUrl();
        await client.connect(endpoint);

        let err = undefined;
        try {
            const session = await client.createSession();
            await session.close();
        } catch (_err) {
            err = _err as Error;
            console.log("err =", err.message);
        }
        await client.disconnect();
        policyIdSetToNull.should.eql(true, "policyIdSetToNull  failed");
        should.not.exist(err);
    });
});
