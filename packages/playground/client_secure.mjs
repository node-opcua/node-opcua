import path from "path";
import os from "os";
import url from 'url';
import { OPCUAClient, MessageSecurityMode, SecurityPolicy, OPCUACertificateManager } from "node-opcua";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
// const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const endpointUrl = "opc.tcp://minipc1-ts:26543";
(async () => {

    const rootFolder = path.join(__dirname, "dist/testPKI");

    const clientCertificateManager = new OPCUACertificateManager({
        rootFolder,
        automaticallyAcceptUnknownCertificate: false
    })
    await clientCertificateManager.initialize();

    const client = OPCUAClient.create({
        endpointMustExist: false,
        applicationUri: 
        clientCertificateManager,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256,
    });

    await client.withSessionAsync(endpointUrl, async (session) => {
        console.log("connected");
    });
    console.log("disconnected");

    await clientCertificateManager.dispose();

})();
