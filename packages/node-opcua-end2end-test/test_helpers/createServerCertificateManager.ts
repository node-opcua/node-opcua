import * as path from "path";
import * as os from "os";
import * as fs from "fs";
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
