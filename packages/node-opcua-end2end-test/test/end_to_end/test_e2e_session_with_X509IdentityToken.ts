// tslint:disable:no-var-requires
const mocha = require("mocha");
import * as fs from "fs";
import * as path from "path";

import {
    empty_nodeset_filename,
    OPCUAClient,
    OPCUAServer,
} from "node-opcua";
import {
    UserIdentityInfoX509
} from "node-opcua-client";

const should = require("should");
import * as  crypto_utils from "node-opcua-crypto";
import {Certificate, PrivateKey, PrivateKeyPEM} from "node-opcua-crypto";
import { UserTokenType } from "node-opcua-types";

const port = 5000;

let server: OPCUAServer;
let endpointUrl: string;
// openssl req -x509 -newkey rsa:4096 -sha256 -nodes -keyout example.pem \
//        -outform der -out example.der -subj "/CN=example.com" -days 3650
async function startServer(): Promise<OPCUAServer> {

    server = new OPCUAServer({
        maxAllowedSessionNumber: 10,
        nodeset_filename: empty_nodeset_filename,
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

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Session with user certificate", () => {

    before(startServer);
    after(endServer);

    it("should create a session with client certificates", async () => {

        const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
        const clientCertificateFilename = path.join(certificateFolder, "client_cert_2048.pem");
        const clientCertificate: Certificate = crypto_utils.readCertificate(clientCertificateFilename);

        const clientPrivateKeyFilename = path.join(certificateFolder, "client_key_2048.pem");
        const privateKey: PrivateKeyPEM = crypto_utils.readPrivateKeyPEM(clientPrivateKeyFilename);

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: clientCertificate,
            privateKey,
            type: UserTokenType.Certificate,
        };
        const session = await client.createSession(userIdentity);

        await session.close();

        await client.disconnect();
    });
});
