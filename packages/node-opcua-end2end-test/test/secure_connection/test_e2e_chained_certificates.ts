import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MessageSecurityMode, OPCUACertificateManager, OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";
import {
    convertPEMtoDER,
    exploreCertificate,
    readCertificateChain,
    readCertificateRevocationList,
    split_der
} from "node-opcua-crypto";
import { CertificateAuthority } from "node-opcua-pki";
import should from "should";

describe("End-to-End Chained Certificates", function (this: Mocha.Suite) {
    this.timeout(200000);

    const tmpFolder = path.join(__dirname, "../../tmp_chained_test");
    if (!fs.existsSync(tmpFolder)) {
        fs.mkdirSync(tmpFolder);
    }

    let ca: CertificateAuthority;
    const caLocation = path.join(tmpFolder, "CA");

    before(async () => {
        if (fs.existsSync(tmpFolder)) {
            // cleanup
            fs.rmSync(tmpFolder, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpFolder);

        ca = new CertificateAuthority({
            keySize: 2048,
            location: caLocation
        });
        await ca.initialize();
    });

    function dumpCertificate(certificate: Buffer | string) {
        const der = typeof certificate === "string" ? convertPEMtoDER(certificate) : certificate;
        const chain = split_der(der);
        console.log(`chain\n${chain.map((c) => `   ${c.toString("hex").substring(0, 100)}`).join("\n")}`);

        for (let i = 0; i < chain.length; i++) {
            const info = exploreCertificate(chain[i]);
            console.log(`  Certificate ${i}:`);
            console.log("    serialNumber                    ", info.tbsCertificate.serialNumber);
            console.log("    commonName                      ", info.tbsCertificate.subject.commonName);
            console.log("    issuer                          ", info.tbsCertificate.issuer.commonName);
            console.log("    subjectKeyIdentifier            ", info.tbsCertificate.extensions?.subjectKeyIdentifier);
            console.log(
                "    authorityKeyIdentifier issuer   ",
                info.tbsCertificate.extensions?.authorityKeyIdentifier?.authorityCertIssuer?.commonName
            );
            console.log(
                "    authorityKeyIdentifier key      ",
                info.tbsCertificate.extensions?.authorityKeyIdentifier?.keyIdentifier
            );
        }
    }
    async function createSignedCertInManager(
        mgr: OPCUACertificateManager,
        name: string
    ) {
        const isClient = name.toLowerCase().includes("client");

        /// ---- Create CSR ----
        console.log("Creating CSR for", name);
        const csrFile = await mgr.createCertificateRequest({
            applicationUri: `urn:localhost:${name}`,
            dns: [os.hostname(), "localhost"],
            subject: `/CN=${name}`,
            validity: 365
        });

        /// ---- Sign CSR ----
        const certificateFile = path.join(mgr.ownCertFolder, isClient ? "client_certificate.pem" : "certificate.pem");

        console.log(`Creating signed certificate for ${name} at ${certificateFile.replace(process.cwd(), ".")}`);
        await ca.signCertificateRequest(certificateFile, csrFile, {
            applicationUri: `urn:localhost:${name}`,
            dns: [os.hostname(), "localhost"]
        });

        /// ---- Append CA certificate to create a chain ----
        const leaf = fs.readFileSync(certificateFile, "utf8");
        console.log("leaf\n");
        dumpCertificate(leaf);

        // const caCert = fs.readFileSync(ca.caCertificate, "utf8");
        // console.log("caCert\n");
        // dumpCertificate(caCert);

        // fs.writeFileSync(certificateFile, Buffer.concat([Buffer.from(leaf), Buffer.from(caCert)]));
        return certificateFile;
    }

    async function installIssuerAndCRL(mgr: OPCUACertificateManager) {
        const caCertificateChain = readCertificateChain(ca.caCertificate);
        should(caCertificateChain).be.instanceOf(Array);
        should(caCertificateChain.length).be.eql(1);
        const caCertificate = caCertificateChain[0];

        await mgr.addIssuer(caCertificate, false, true);

        const certificateRevocationList = await readCertificateRevocationList(ca.revocationList);
        await mgr.addRevocationList(certificateRevocationList);
    }

    async function setupServer(
        name: string,
        rootFolder: string,
        options: {
            automaticallyAcceptUnknownCertificate?: boolean;
        } = {}
    ) {
        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: rootFolder,
            automaticallyAcceptUnknownCertificate: options.automaticallyAcceptUnknownCertificate
        });
        await serverCertificateManager.initialize();

        await installIssuerAndCRL(serverCertificateManager);

        await createSignedCertInManager(serverCertificateManager, name);

        const server = new OPCUAServer({
            port: 0,
            serverInfo: {
                applicationUri: `urn:localhost:${name}`
            },
            serverCertificateManager,
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.SignAndEncrypt]
        });
        await server.initialize();

        // to do :

        return server;
    }

    it("1/ verify that a client and a server with certificates issued by the same CA can establish a secure connection", async () => {
        const serverPki = path.join(tmpFolder, "server1_pki");
        const server = await setupServer("server1", serverPki);
        const serverCertificateManager = server.serverCertificateManager;
        const caCertificateChain = readCertificateChain(ca.caCertificate);
        should(caCertificateChain).be.instanceOf(Array);
        should(caCertificateChain.length).be.eql(1);
        const caCertificate = caCertificateChain[0];

        await serverCertificateManager.addIssuer(caCertificateChain[0], false, true);

        const certificateRevocationList = await readCertificateRevocationList(ca.revocationList);
        await serverCertificateManager.addRevocationList(certificateRevocationList);

        await server.start();
        const endpointUrl = server.getEndpointUrl();

        const clientPki = path.join(tmpFolder, "client1_pki");
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: clientPki
        });
        await clientCertificateManager.initialize();

        // Client trusts the CA
        await clientCertificateManager.addIssuer(caCertificate, false, true);
        await clientCertificateManager.addRevocationList(certificateRevocationList);

        await createSignedCertInManager(clientCertificateManager, "client1");


        const client = OPCUAClient.create({
            applicationUri: "urn:localhost:client1",
            clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
            // don't provide: serverCertificate: server.getCertificateChain()
        });

        try {
            await client.withSessionAsync(endpointUrl, async (_session) => {
                // should succeed
            });
        } finally {
            await server.shutdown();
        }
    });

    it("2/ verify that a client fitted with a chained certificate can automatically connect securely to a server in Configuration Mode", async () => {
        // Server in configuration mode: automaticallyAcceptUnknownCertificate=true
        const serverPki = path.join(tmpFolder, "server2_pki");
        const server = await setupServer("server2", serverPki, {
            automaticallyAcceptUnknownCertificate: true
        });

        await server.start();
        const endpointUrl = server.getEndpointUrl();

        const clientPki = path.join(tmpFolder, "client2_pki");
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: clientPki
        });
        await clientCertificateManager.initialize();
        await createSignedCertInManager(clientCertificateManager, "client2");

        // Client needs the CA issuer + CRL to verify the server's certificate
        const caCertificateChain = readCertificateChain(ca.caCertificate);
        await clientCertificateManager.addIssuer(caCertificateChain[0], false, true);
        const certificateRevocationList = await readCertificateRevocationList(ca.revocationList);
        await clientCertificateManager.addRevocationList(certificateRevocationList);

        // The client connects with its chain.
        const client = OPCUAClient.create({
            applicationUri: "urn:localhost:client2",
            clientCertificateManager: clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
            // don't provided: serverCertificate: server.getCertificateChain()
        });

        try {
            await client.withSessionAsync(endpointUrl, async (_session) => {
                // The server is in configuration mode (automaticallyAcceptUnknownCertificate=true)
                // and should be able to extract the CA from the client's chained certificate
                // and accept the connection.
            });
        } finally {
            await server.shutdown();
        }
    });
});
