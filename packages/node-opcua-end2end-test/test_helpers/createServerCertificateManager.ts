import * as crypto from "crypto";
import * as path from "path";
import * as os from "os";
import { OPCUACertificateManager } from "node-opcua";

export async function createServerCertificateManager(port: number): Promise<OPCUACertificateManager> {
    const randomSeed = crypto.randomBytes(16).toString("hex");
    const rootFolder = path.join(os.tmpdir(), randomSeed);

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder
    });

    await serverCertificateManager.initialize();

    return serverCertificateManager;
}
/*
import envPaths = require("env-paths");
const config = envPaths("MiniNodeOPCUA-Server").config;
const pkiFolder = path.join(config, "pki");
*/
