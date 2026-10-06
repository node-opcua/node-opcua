// the server options of a front thread in test_front_threads.ts: built in the front, with a
// certificate folder of its own (fronts must not share one)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";

export default async function frontServerOptions(data, { front }) {
    const rootFolder = path.join(os.tmpdir(), "node-opcua-tmp", `front-threads-${data.port}-${front}`);
    fs.mkdirSync(rootFolder, { recursive: true });
    const serverCertificateManager = new OPCUACertificateManager({ automaticallyAcceptUnknownCertificate: true, rootFolder });
    await serverCertificateManager.initialize();
    return {
        port: data.port,
        serverCertificateManager,
        allowAnonymous: true,
        maxConnectionsPerEndpoint: data.maxConnectionsPerEndpoint,
        serverCapabilities: { minSupportedSampleRate: 0, ...data.serverCapabilities }
    };
}
