// tslint:disable:no-var-requires
import * as fs from "fs";
import * as path from "path";

import {
    get_empty_nodeset_filename,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
} from "node-opcua";
import {
    UserIdentityInfoX509, UserTokenType
} from "node-opcua-client";

import * as should from "should";
import * as  crypto_utils from "node-opcua-crypto";
import { Certificate, PrivateKey, PrivateKeyPEM, readCertificate, readCertificateRevocationList } from "node-opcua-crypto";

const empty_nodeset_filename = get_empty_nodeset_filename();

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

const tmpFolder = path.join(__dirname, "../../tmp");

const port = 2231;

let server: OPCUAServer;
let endpointUrl: string;
// openssl req -x509 -newkey rsa:4096 -sha256 -nodes -keyout example.pem \
//        -outform der -out example.der -subj "/CN=example.com" -days 3650
async function startServer(): Promise<OPCUAServer> {


    const serverCertificateManager = new OPCUACertificateManager({
        rootFolder: path.join(tmpFolder, "serverPKI" + port),
        automaticallyAcceptUnknownCertificate: false,
    });
    await serverCertificateManager.initialize();


    const userCertificateManager = new OPCUACertificateManager({
        rootFolder: path.join(tmpFolder, "userPKI" + port),
        automaticallyAcceptUnknownCertificate: false,
    });
    await userCertificateManager.initialize();

    server = new OPCUAServer({
        userCertificateManager,

        serverCertificateManager,

        maxAllowedSessionNumber: 10,

        nodeset_filename: empty_nodeset_filename,
        port,
    });
    await server.start();

    const issuerCertificateFile = path.join(certificateFolder, "CA/public/cacert.pem");

    const issuerCertificate = readCertificate(issuerCertificateFile);

    await server.userCertificateManager.addIssuer(issuerCertificate);
    await server.serverCertificateManager.addIssuer(issuerCertificate);

    const issuerCertificateRevocationListFile = path.join(certificateFolder, "CA/crl/revocation_list.der");
    const crl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
    await server.userCertificateManager.addRevocationList(crl);
    await server.serverCertificateManager.addRevocationList(crl);

    endpointUrl = server.getEndpointUrl()!;
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

    const clientPrivateKeyFilename = path.join(certificateFolder, "client_key_2048.pem");
    const privateKey: PrivateKeyPEM = crypto_utils.readPrivateKeyPEM(clientPrivateKeyFilename);

    const wrongClientPrivateKeyFilename = path.join(certificateFolder, "server_key_2048.pem");
    const wrongPrivateKey: PrivateKeyPEM = crypto_utils.readPrivateKeyPEM(wrongClientPrivateKeyFilename);

    const clientCertificateFilename = path.join(certificateFolder, "client_cert_2048.pem");
    const clientCertificate: Certificate = crypto_utils.readCertificate(clientCertificateFilename);
    const invalidClientCertificateFilename = path.join(certificateFolder, "client_cert_2048_outofdate.pem");
    const invalidClientCertificate: Certificate = crypto_utils.readCertificate(invalidClientCertificateFilename);
    const notActiveClientCertificateFilename = path.join(certificateFolder, "client_cert_2048_not_active_yet.pem");
    const notActiveClientCertificate: Certificate = crypto_utils.readCertificate(notActiveClientCertificateFilename);

    let client: OPCUAClient | null = null;

    beforeEach(async () => {
        client = OPCUAClient.create({});
        await client.connect(endpointUrl);

        // make sure all certificates are "trusted"
        await server.userCertificateManager.trustCertificate(clientCertificate);
        await server.userCertificateManager.trustCertificate(invalidClientCertificate);
        await server.userCertificateManager.trustCertificate(notActiveClientCertificate);

    });

    afterEach(async () => {
        await server.userCertificateManager.trustCertificate(clientCertificate);
        await server.userCertificateManager.trustCertificate(invalidClientCertificate);
        await server.userCertificateManager.trustCertificate(notActiveClientCertificate);
        await client!.disconnect();
        client = null;
    });

    it("should create a session with a trusted client certificate", async () => {

        await server.userCertificateManager.trustCertificate(clientCertificate);

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: clientCertificate,
            privateKey,
            type: UserTokenType.Certificate,
        };
        const session = await client!.createSession(userIdentity);
        await session.close();

    });

    it("should fail to create a session with a valid client certificate which is untrusted", async () => {

        await server.userCertificateManager.rejectCertificate(clientCertificate);

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: clientCertificate,
            privateKey,
            type: UserTokenType.Certificate,
        };
        let exceptionCaught: Error | null = null;
        try {
            const session = await client!.createSession(userIdentity);
            await session.close();

        } catch (err) {
            exceptionCaught = err as Error;
        }
        should(exceptionCaught).not.be.null();

        await server.userCertificateManager.trustCertificate(clientCertificate);

    });


    it("should fail to create a session with a invalid client certificate (out-of-date)", async () => {

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: invalidClientCertificate,
            privateKey,
            type: UserTokenType.Certificate,
        };
        let exceptionCaught: Error | null = null;
        try {
            const session = await client!.createSession(userIdentity);
            await session.close();
        } catch (err) {
            exceptionCaught = err as Error;
        }
        should(exceptionCaught).not.be.null();

    });

    it("should fail to create a session with a invalid client certificate (not_active_yet)", async () => {

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: notActiveClientCertificate,
            privateKey,
            type: UserTokenType.Certificate,
        };
        let exceptionCaught: Error | null = null;
        try {
            const session = await client!.createSession(userIdentity);
            await session.close();
        } catch (err) {
            exceptionCaught = err as Error;
        }
        should(exceptionCaught).not.be.null();
    });
    it("should fail to create a session with a  client certificate and wrong privateKey", async () => {

        const userIdentity: UserIdentityInfoX509 = {
            certificateData: clientCertificate,
            privateKey: wrongPrivateKey,
            type: UserTokenType.Certificate,
        };
        let exceptionCaught: Error | null = null;
        try {
            const session = await client!.createSession(userIdentity);
            await session.close();
        } catch (err: any) {
            exceptionCaught = err; 
        }
        should(exceptionCaught).not.be.null();
    });
});
