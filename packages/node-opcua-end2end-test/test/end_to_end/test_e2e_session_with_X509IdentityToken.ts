import * as fs from "fs";
import * as path from "path";

import {
    nodesets,
    OPCUAClient,
    OPCUAServer,
    UserIdentityCertificateInfo
} from "node-opcua";

const should = require("should");
import * as  crypto_utils from "node-opcua-crypto";
import {Certificate, PrivateKey} from "node-opcua-crypto";

const port = 5000;

let server: OPCUAServer;
let endpointUrl: string;

async function startServer(): Promise<OPCUAServer> {

    server = new OPCUAServer({
        maxAllowedSessionNumber: 10,
        nodeset_filename: nodesets.empty_nodeset_filename,
        port,
    });
    await server.start();
    endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;
    return server;
}

async function endServer() {
    if (server) {
        await server.shutdown(1);
    }
}

// xx const perform_operation_on_client_session =
// require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Session with user certificate", () => {

    before(startServer);
    after(endServer);

    it("should create a session with client certificates", async () => {

        const certificateFolder = path.join(__dirname, "../../node_opcua_samples/certificates");
        const clientCertificateFilename = path.join(certificateFolder, "client_cert_2048.pem");
        const clientCertificate: Certificate = crypto_utils.readCertificate(clientCertificateFilename);

        const clientPrivateKeyFilename = path.join(certificateFolder, "client_key_2048.pem");
        const clientPrivateKey: PrivateKey = crypto_utils.readPrivateKey(clientPrivateKeyFilename);

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);

        const userIdentity: UserIdentityCertificateInfo = {
            clientCertificate, clientPrivateKey
        };
        const session = await client.createSession(userIdentity);

        await session.close();

        await client.disconnect();
    });
});
