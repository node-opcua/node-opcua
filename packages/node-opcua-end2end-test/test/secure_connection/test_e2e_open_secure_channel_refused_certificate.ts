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
 *
 * FEAT-44: a CA without a revocation list. When it is the certificate's own
 * CA the answer is BadCertificateRevocationUnknown, which the CTT accepts
 * (Security Certificate Validation 042/043); when it is an issuer higher in
 * the chain the certificate manager says BadCertificateIssuerRevocationUnknown
 * but the wire says BadSecurityChecksFailed, as Errata 1.04.12 asks (002
 * warned about the precise code).
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
import { CertificateAuthority } from "node-opcua-pki";
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

    describe("a CA without a revocation list (FEAT-44)", () => {
        // the CTT's own PKI: ctt_ca1TC, a trusted root whose revocation list is
        // not available, and ctt_ca1TC_ca2I, an intermediate under it, known
        // (issuers/) with its revocation list
        let root: CertificateAuthority;
        let intermediate: CertificateAuthority;

        before(async () => {
            // distinct subjects: the certificate manager files a revocation list
            // under its issuer's subject name, so two CAs called NodeOPCUA-CA (the
            // default, also the samples CA of FEAT39-3) would share their lists
            root = new CertificateAuthority({
                keySize: 2048,
                location: path.join(tmpFolder, "root-ca"),
                subject: "/CN=FEAT-44 root CA"
            });
            await root.initialize();
            intermediate = new CertificateAuthority({
                keySize: 2048,
                location: path.join(tmpFolder, "intermediate-ca"),
                subject: "/CN=FEAT-44 intermediate CA",
                issuerCA: root
            });
            await intermediate.initialize();

            await serverCertificateManager.trustCertificate(readCertificateChain(root.caCertificate)[0]);
            // and no root.revocationList
            await serverCertificateManager.addIssuer(readCertificateChain(intermediate.caCertificate)[0]);
            await serverCertificateManager.addRevocationList(await readCertificateRevocationList(intermediate.revocationList));
        });

        /** a certificate for the client, issued by `ca`, trusted by the server (the CTT's *_appT) */
        async function issueTrustedClientCertificate(ca: CertificateAuthority, name: string): Promise<string> {
            const applicationUri = `urn:localhost:${name}`;
            const csrFile = await clientCertificateManager.createCertificateRequest({
                applicationUri,
                dns: ["localhost"],
                subject: `/CN=${name}`,
                validity: 365
            });
            const certificateFile = path.join(tmpFolder, `${name}.pem`);
            await ca.signCertificateRequest(certificateFile, csrFile, { applicationUri, dns: ["localhost"] });
            // the file holds the chain (leaf, then its issuer): only the leaf is trusted
            await serverCertificateManager.trustCertificate(readCertificateChain(certificateFile)[0]);
            return certificateFile;
        }

        it("FEAT44-1 an issuer that cannot be checked for revocation is refused with BadSecurityChecksFailed (Errata 1.04.12)", async () => {
            // CTT Security Certificate Validation 002: ctt_ca1TC_ca2I_appT. Nothing
            // is wrong with the certificate or the intermediate itself; the root
            // has no revocation list, so the intermediate cannot be checked.
            const certificateFile = await issueTrustedClientCertificate(intermediate, "feat44-issuer-revocation-unknown");
            const chain = readCertificateChain(certificateFile);
            chain.length.should.eql(2, "the leaf and the intermediate");
            // the certificate manager keeps the precise verdict
            (await serverCertificateManager.checkCertificate(chain)).should.eql(StatusCodes.BadCertificateIssuerRevocationUnknown);

            const client = secureClient({ certificateFile, privateKeyFile: clientCertificateManager.privateKey });
            const error = await connectAndExpectRefusal(client);

            // but the wire does not say more than "security checks failed"
            error.message.should.match(/BadSecurityChecksFailed/);
            should(error.statusCode).eql(StatusCodes.BadSecurityChecksFailed);
            should(error.response).be.instanceOf(ServiceFault);
            (error.response as ServiceFault).responseHeader.serviceResult.should.eql(StatusCodes.BadSecurityChecksFailed);
        });

        it("FEAT44-2 a certificate whose own CA has no revocation list is still refused with BadCertificateRevocationUnknown", async () => {
            // CTT Security Certificate Validation 042: ctt_ca1TC_appT
            const certificateFile = await issueTrustedClientCertificate(root, "feat44-revocation-unknown");
            (await serverCertificateManager.checkCertificate(readCertificateChain(certificateFile))).should.eql(
                StatusCodes.BadCertificateRevocationUnknown
            );

            const client = secureClient({ certificateFile, privateKeyFile: clientCertificateManager.privateKey });
            const error = await connectAndExpectRefusal(client);

            error.message.should.match(/BadCertificateRevocationUnknown/);
            should(error.statusCode).eql(StatusCodes.BadCertificateRevocationUnknown);
            should(error.response).be.instanceOf(ServiceFault);
        });
    });
});
