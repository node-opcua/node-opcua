import { ActivateSessionRequest, AnonymousIdentityToken, MessageSecurityMode, OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";
import should from "should";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager.js";
const port = 2235;
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
describe("Testing client that have policyId = null in Activate Session for anonymous connection", () => {
    let server;
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
        const clientEx = client;
        const original_performMessageTransaction = clientEx.performMessageTransaction;
        clientEx.performMessageTransaction = (request, callback) => {
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
        let err;
        try {
            const session = await client.createSession();
            await session.close();
        }
        catch (_err) {
            err = _err;
            console.log("err =", err.message);
        }
        await client.disconnect();
        policyIdSetToNull.should.eql(true, "policyIdSetToNull  failed");
        should.not.exist(err);
    });
});
//# sourceMappingURL=test_client_with_null_policyid_in_activate_session.js.map