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
    // hooks that count their calls where the test sees them (a session worker is another thread)
    const counts = data.hookCounts ? new Int32Array(data.hookCounts) : null;
    // a session worker that ends at the first monitored item it creates (the test of a worker that dies)
    if (data.endWorkerOnFirstItem && front === -1) {
        return {
            onCreateMonitoredItem: async () => {
                setImmediate(() => {
                    throw new Error("session worker ended by the test");
                });
            }
        };
    }
    const hooks = counts
        ? {
              onCreateMonitoredItem: async () => {
                  Atomics.add(counts, 0, 1);
              },
              onDeleteMonitoredItem: async () => {
                  Atomics.add(counts, 1, 1);
              }
          }
        : {};
    return { port: data.port, serverCertificateManager, allowAnonymous: true, serverCapabilities: { minSupportedSampleRate: 0 }, ...hooks };
}
