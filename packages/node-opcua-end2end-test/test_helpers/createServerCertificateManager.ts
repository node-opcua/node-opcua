import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua";

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
