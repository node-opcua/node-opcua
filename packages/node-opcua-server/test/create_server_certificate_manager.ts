import path from "path";
import os from "os";
import fs from "fs";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";

export async function createServerCertificateManager(port: number): Promise<OPCUACertificateManager> {
    const tmpFolder = path.join(os.tmpdir(), "node-opcua-tmp");
    try {
        fs.mkdirSync(tmpFolder);
    } catch (err) {
        /** */
    }
    const rootFolder = path.join(tmpFolder, `server${port}`);
    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder
    });

    await serverCertificateManager.initialize();

    return serverCertificateManager;
}
