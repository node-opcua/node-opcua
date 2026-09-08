/**
 * FEAT-39: a server that refuses the client certificate answers the
 * OpenSecureChannel with a ServiceFault carrying the status code.
 *
 * Part 6 6.7.4: once the security of the request is verified, an error is
 * answered with a ServiceFault in place of the OpenSecureChannel response,
 * secured like that response. Answered with a transport-level ERR message
 * instead, the refusal told nothing: the CTT read the connect as Good and its
 * Security Certificate Validation scripts failed with "the connection was
 * granted", and node-opcua's own client only reported a closed socket.
 *
 * Status codes, as the server maps them: an untrusted or badly signed or
 * revoked certificate is BadSecurityChecksFailed (the client learns nothing
 * about the trust list); a certificate out of its validity period is
 * BadCertificateTimeInvalid, passed through, so that a client can tell what to
 * fix.
 */
import fs from "node:fs";
import path from "node:path";
import {
    get_empty_nodeset_filename,
    MessageSecurityMode,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy,
    ServiceFault,
    type StatusCode,
    StatusCodes
} from "node-opcua";
import { readCertificate, readCertificateChain, readCertificateRevocationList } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { certificateFolder, tmpFolderFor } from "../../test_helpers/paths.js";

type RejectedConnection = Error & { statusCode?: StatusCode; response?: unknown };

const port = 5800;

describe("OpenSecureChannel refused because of the client certificate (FEAT-39)", function (this: Mocha.Suite) {
    this.timeout(Math.max(60_000, this.timeout()));

    const tmpFolder = tmpFolderFor("feat39");
    let server: OPCUAServer;
    let endpointUrl: string;
    let serverCertificateManager: OPCUACertificateManager;
    let clientCertificateManager: OPCUACertificateManager;

    before(async () => {
        fs.rmSync(tmpFolder, { recursive: true, force: true });
        serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "server-pki"),
            automaticallyAcceptUnknownCertificate: false
        });
        await serverCertificateManager.initialize();
        // the client trusts the server; the server decides about the client
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "client-pki"),
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();

        server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: get_empty_nodeset_filename(),
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.SignAndEncrypt]
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
        await serverCertificateManager.dispose();
        await clientCertificateManager.dispose();
    });

    async function connectAndExpectRefusal(client: OPCUAClient): Promise<RejectedConnection> {
        let error: RejectedConnection | undefined;
        try {
            await client.connect(endpointUrl);
            await client.disconnect();
        } catch (err) {
            error = err as RejectedConnection;
        }
        should.exist(error, "expecting the OpenSecureChannel to be refused");
        return error as RejectedConnection;
    }

    function secureClient(extra: Record<string, unknown> = {}): OPCUAClient {
        return OPCUAClient.create({
            clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            endpointMustExist: false,
            connectionStrategy: { maxRetry: 0 },
            ...extra
        });
    }

    it("FEAT39-1 an untrusted client certificate is refused with BadSecurityChecksFailed, said in a ServiceFault", async () => {
        const client = secureClient();
        const error = await connectAndExpectRefusal(client);

        error.message.should.match(/rejected by server/);
        error.message.should.match(/BadSecurityChecksFailed/);
        should(error.statusCode).eql(StatusCodes.BadSecurityChecksFailed);
        // a decoded ServiceFault on the error is what tells a secured refusal from a dropped socket
        should(error.response).be.instanceOf(ServiceFault);
        (error.response as ServiceFault).responseHeader.serviceResult.should.eql(StatusCodes.BadSecurityChecksFailed);

        // and the server has recorded the refusal
        const clientCertificate = readCertificate(client.certificateFile);
        (await serverCertificateManager.getTrustStatus(clientCertificate)).should.eql(StatusCodes.BadCertificateUntrusted);
        fs.readdirSync(path.join(serverCertificateManager.rootDir, "rejected")).length.should.be.greaterThan(0);
    });

    it("FEAT39-2 the same certificate connects once the server trusts it", async () => {
        const client = secureClient();
        await serverCertificateManager.trustCertificate(readCertificate(client.certificateFile));
        await client.connect(endpointUrl);
        const session = await client.createSession();
        await session.close();
        await client.disconnect();
    });

    it("FEAT39-3 a trusted certificate that is out of date is refused with BadCertificateTimeInvalid", async () => {
        const certificateFile = path.join(certificateFolder, "client_cert_2048_outofdate.pem");
        const privateKeyFile = path.join(certificateFolder, "client_key_2048.pem");
        const chain = readCertificateChain(certificateFile);
        chain.length.should.eql(2, "the sample certificate comes with its issuer");
        // trusted, issuer known with its revocation list: only the validity period is wrong
        await serverCertificateManager.trustCertificate(chain[0]);
        await serverCertificateManager.addIssuer(chain[1]);
        await serverCertificateManager.addRevocationList(
            await readCertificateRevocationList(path.join(certificateFolder, "CA", "crl", "revocation_list.crl"))
        );

        const client = secureClient({ certificateFile, privateKeyFile });
        const error = await connectAndExpectRefusal(client);

        error.message.should.match(/BadCertificateTimeInvalid/);
        should(error.statusCode).eql(StatusCodes.BadCertificateTimeInvalid);
        should(error.response).be.instanceOf(ServiceFault);
    });
});
