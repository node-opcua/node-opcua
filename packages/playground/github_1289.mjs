import fs from "fs";
import path from "path";
import { OPCUACertificateManager } from "node-opcua";

const pkiRoot = "/tmp/pki1289";
const certificateFile = path.join(pkiRoot, "server_selfsigned_cert_2048.pem");
const selfSignedCertificatePath = certificateFile;
const appName = "RpiPlc";

const data = {
    "applicationUri": "urn:rpi-plc-deployment-55cc7bbc64-r89h4:RpiPlc",
    "dns": [
        "rpi-plc-deployment-55cc7bbc64-r89h4"
    ],
    "outputFile": "/rpi-plc/data/.config/PKI/certificate.pem",
    "subject": "/CN=RpiPlc/O=TestSHome/L=Midway/C=US",
    "startDate": "2023-08-15T06:16:15.077Z",
    "validity": 3650
};


const ModuleName = "";
(async () => {


    console.log("starting from fresh:  deleting existing pki folder")
    if (fs.existsSync(pkiRoot)) {
        fs.rmdirSync(pkiRoot, { recursive: true });
    }

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: pkiRoot
    });
    try {

        await serverCertificateManager.initialize();

        if (!fs.existsSync(certificateFile)) {
            console.log([ModuleName, 'info'], `Creating new certificate file:`);

            const certFileRequest = {
                applicationUri: data.applicationUri,
                dns: data.dns,
                // ip: await getIpAddresses(),
                outputFile: selfSignedCertificatePath,
                subject: `/CN=${appName}/O=TestHome/L=Midway/C=US`,
                startDate: new Date(),
                validity: 365 * 10
            };

            console.log([ModuleName, 'info'], `Self-signed certificate file request params:\n${JSON.stringify(certFileRequest, null, 2)}\n`);

            await serverCertificateManager.createSelfSignedCertificate(certFileRequest);
        }
        else {
            console.log([ModuleName, 'info'], `Using existing certificate file at: ${certificateFile}`);
        }
    }
    catch (ex) {
        console.log(ex);
        console.log([ModuleName, 'error'], `Error creating server self signed certificate: ${ex.message}`);
    }
})();
