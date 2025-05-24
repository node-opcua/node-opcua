import { getFullyQualifiedDomainName, getHostname, makeSubject, MessageSecurityMode, OPCUACertificateManager, OPCUAClient, OPCUAServer, randomGuid, SecurityPolicy } from "node-opcua";
import os from "os";
import path from "path";
import should from "should"

const port = 62001;

const tmpFolder = os.tmpdir();

async function startServerWithExpiredCertificate() {
    const rootFolder = path.join(tmpFolder, "serverPki");
    const serverCertificateManager = new OPCUACertificateManager({
        rootFolder
    });
    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        securityPolicies: [SecurityPolicy.Basic256Sha256]
    });

    await server.initialize();


    const fqdn = getFullyQualifiedDomainName();
    const hostname = getHostname();
    const dns = [...new Set([fqdn, hostname])];

    // overwrite default certificate with a expired one
    await server.serverCertificateManager.createSelfSignedCertificate({
        applicationUri: server.serverInfo.applicationUri!,
        dns,
        startDate: new Date(2000, 10, 0),
        validity: 100,
        subject: makeSubject(server.serverInfo.applicationName.text!, hostname),
        outputFile: server.certificateFile
    })

    await server.start();

    console.log("server started at", server.getEndpointUrl());

    process.once("SIGINT", ()=>{
        server.shutdown();
    })
    return server;

}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Security: verifying some security use cases", function(this: any) {

    this.timeout(100000);
    let server: OPCUAServer;
    before(async()=>{
        server = await startServerWithExpiredCertificate();
    })
    after(async()=>{
        await server.shutdown();
    })
    it("a client should not allow connection with a server that have a outdated certificate", async()=>{

        const endpointUrl = server.getEndpointUrl();

        const rootFolder = path.join(tmpFolder, "clientPki");

        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder
        });
        await clientCertificateManager.initialize();

        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager,
            // The following options attempt to bypass certificate validation
            allowUntrusted: true,
            rejectUnauthorized: false
        } as any);
        await client.createDefaultCertificate();

        // trust the server certificate 
        const serverCertificate = server.getCertificate();
        client.clientCertificateManager.trustCertificate(serverCertificate);

        let  catchedError: Error|null = null;

        try {
            await client.connect(endpointUrl);
            console.log("Client Connected");
            await client.disconnect();
        } catch(err) {
            catchedError = err as Error;
            console.log((err as Error).message);
        }
        console.log("pkis are in ", tmpFolder);

        should(catchedError).not.eql(null);
        // await new Promise((resolve)=> process.on("SIGINT", resolve));
    });
});