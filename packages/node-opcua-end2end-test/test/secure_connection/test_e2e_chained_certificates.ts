import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AttributeIds, MessageSecurityMode, OPCUACertificateManager, OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";
import {
    convertPEMtoDER,
    exploreCertificate,
    readCertificateChain,
    readCertificateRevocationList,
    split_der
} from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { CertificateAuthority } from "node-opcua-pki";
import should from "should";
import "mocha";
import { scratch } from "../../test_helpers/paths.js";

const port2 = 5013;

const port1 = 5012;

describe("End-to-End Chained Certificates", function (this: Mocha.Suite) {
    this.timeout(200000);

    const tmpFolder = scratch("tmp_chained_test");
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
    async function createSignedCertInManager(mgr: OPCUACertificateManager, name: string) {
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
            port: port1,
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

    // Helper: create a server whose certificate.pem contains the full chain (leaf + CA)
    async function setupServerWithChainedCertificate(
        name: string,
        rootFolder: string,
        options: { automaticallyAcceptUnknownCertificate?: boolean; sendCertificateChainInCreateSession?: boolean } = {}
    ) {
        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: rootFolder,
            automaticallyAcceptUnknownCertificate: options.automaticallyAcceptUnknownCertificate
        });
        await serverCertificateManager.initialize();

        await installIssuerAndCRL(serverCertificateManager);

        const certificateFile = await createSignedCertInManager(serverCertificateManager, name);

        // Append the CA certificate to the server's PEM to form a chain
        const leafPem = fs.readFileSync(certificateFile, "utf8");
        const caCertPem = fs.readFileSync(ca.caCertificate, "utf8");
        fs.writeFileSync(certificateFile, `${leafPem}\n${caCertPem}`);

        const chainCheck = readCertificateChain(certificateFile);
        should(chainCheck.length).be.greaterThanOrEqual(2, "certificate.pem should contain at least leaf + CA");

        const server = new OPCUAServer({
            port: port2,
            serverInfo: {
                applicationUri: `urn:localhost:${name}`
            },
            serverCertificateManager,
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            sendCertificateChainInCreateSession: options.sendCertificateChainInCreateSession
        });
        await server.initialize();
        return server;
    }

    // a client whose own certificate is issued by the CA and trusts it
    async function setupClientCertificateManager(name: string) {
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, `${name}_pki`),
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();
        const caCertificateChain = readCertificateChain(ca.caCertificate);
        await clientCertificateManager.addIssuer(caCertificateChain[0], false, true);
        await clientCertificateManager.addRevocationList(await readCertificateRevocationList(ca.revocationList));
        await createSignedCertInManager(clientCertificateManager, name);
        return clientCertificateManager;
    }

    it("3a/ a server with a chained certificate sends only its leaf in CreateSession by default", async () => {
        const server = await setupServerWithChainedCertificate("server3a", path.join(tmpFolder, "server3a_pki"), {
            automaticallyAcceptUnknownCertificate: true
        });
        await server.start();
        const serverChain = server.getCertificateChain();
        should(serverChain.length).be.greaterThanOrEqual(2);

        const client = OPCUAClient.create({
            applicationUri: "urn:localhost:client3a",
            clientCertificateManager: await setupClientCertificateManager("client3a"),
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        try {
            await client.withSessionAsync(server.getEndpointUrl(), async (session) => {
                const receivedChain = split_der(session.serverCertificate);
                should(receivedChain.length).eql(1, "CreateSession should carry the leaf certificate only");
                should(receivedChain[0].toString("hex")).eql(serverChain[0].toString("hex"));
            });
        } finally {
            await server.shutdown();
        }
    });

    it("3b/ verify that a server with a chained certificate exposes the full chain in CreateSession when asked to", async () => {
        const serverPki = path.join(tmpFolder, "server3_pki");
        const server = await setupServerWithChainedCertificate("server3", serverPki, {
            automaticallyAcceptUnknownCertificate: true,
            sendCertificateChainInCreateSession: true
        });
        await server.start();
        const endpointUrl = server.getEndpointUrl();

        // ---- Verify server-side: getCertificateChain() returns the full chain ----
        const serverChain = server.getCertificateChain();
        should(serverChain.length).be.greaterThanOrEqual(2, "Server.getCertificateChain() should return at least leaf + CA");

        const serverLeaf = exploreCertificate(serverChain[0]);
        const serverCA = exploreCertificate(serverChain[1]);
        should(serverLeaf.tbsCertificate.issuer.commonName).be.eql(
            serverCA.tbsCertificate.subject.commonName,
            "Leaf issuer should match CA subject"
        );

        // ---- Setup client with CA trust ----
        const clientPki = path.join(tmpFolder, "client3_pki");
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: clientPki,
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();

        const caCertificateChain = readCertificateChain(ca.caCertificate);
        await clientCertificateManager.addIssuer(caCertificateChain[0], false, true);
        const certificateRevocationList = await readCertificateRevocationList(ca.revocationList);
        await clientCertificateManager.addRevocationList(certificateRevocationList);

        await createSignedCertInManager(clientCertificateManager, "client3");

        const client = OPCUAClient.create({
            applicationUri: "urn:localhost:client3",
            clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });

        try {
            await client.withSessionAsync(endpointUrl, async (session) => {
                // ---- Verify client-side: CreateSession response ----
                // session.serverCertificate is the raw DER buffer from the
                // CreateSession response — it should contain the full chain
                const receivedChain = split_der(session.serverCertificate);
                should(receivedChain.length).be.greaterThanOrEqual(
                    2,
                    "CreateSession response should contain the full certificate chain (leaf + CA)"
                );

                const receivedLeaf = exploreCertificate(receivedChain[0]);
                const receivedCA = exploreCertificate(receivedChain[1]);

                // Verify the chain structure
                should(receivedLeaf.tbsCertificate.subject.commonName).eql(
                    "server3",
                    "First certificate should be the server leaf"
                );
                should(receivedLeaf.tbsCertificate.issuer.commonName).eql(
                    receivedCA.tbsCertificate.subject.commonName,
                    "Leaf issuer should match CA subject in the received chain"
                );

                // Verify it matches what the server has on disk
                receivedChain[0]
                    .toString("hex")
                    .should.eql(serverChain[0].toString("hex"), "Received leaf should match server's leaf certificate");
                receivedChain[1]
                    .toString("hex")
                    .should.eql(serverChain[1].toString("hex"), "Received CA should match server's CA certificate");
            });
        } finally {
            await server.shutdown();
        }
    });

    // OPC 10000-4 §6.1.8: a legacy client signs the server certificate exactly as it
    // received it in CreateSession, the whole chain when the server sends one. The
    // server tries the leaf first, then the chain; sending the leaf alone (the
    // default) keeps such clients on the leaf in the first place.
    for (const sendCertificateChainInCreateSession of [false, true]) {
        it(`4/ accepts a legacy client that signs the server certificate as received (sendCertificateChainInCreateSession=${sendCertificateChainInCreateSession})`, async () => {
            const suffix = sendCertificateChainInCreateSession ? "b" : "a";
            const server = await setupServerWithChainedCertificate(
                `server4${suffix}`,
                path.join(tmpFolder, `server4${suffix}_pki`),
                {
                    automaticallyAcceptUnknownCertificate: true,
                    sendCertificateChainInCreateSession
                }
            );
            await server.start();
            const serverChainLength = server.getCertificateChain().length;
            should(serverChainLength).be.greaterThanOrEqual(2);

            const client = OPCUAClient.create({
                applicationUri: `urn:localhost:client4${suffix}`,
                clientCertificateManager: await setupClientCertificateManager(`client4${suffix}`),
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                signServerCertificateChain: true
            });

            try {
                await client.withSessionAsync(server.getEndpointUrl(), async (session) => {
                    // what the legacy client signed: the chain, or the leaf alone
                    should(split_der(session.serverCertificate).length).eql(
                        sendCertificateChainInCreateSession ? serverChainLength : 1
                    );
                    const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
                    should(dataValue.statusCode.isGood()).eql(true);
                });
            } finally {
                await server.shutdown();
            }
        });
    }
});
