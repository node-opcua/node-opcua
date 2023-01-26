import * as fs from "fs";
import * as path from "path";
import { UAObject } from "node-opcua-address-space-base";
import { make_debugLog } from "node-opcua-debug";

const debugLog = make_debugLog("ServerConfiguration");

export interface ChangeDetector {
    on(eventName: "certificateChange", handler: () => void): this;
}
export function installCertificateFileWatcher(node: UAObject, certificateFile: string): ChangeDetector {
    const fileToWatch = path.basename(certificateFile);
    const fsWatcher = fs.watch(path.dirname(certificateFile), { persistent: false }, (eventType: "rename" | "change", filename) => {
        /** */
        if (filename === fileToWatch) {
            debugLog("filename changed = ", filename, fileToWatch);
            node.emit("certificateChange");
        }
    });
    const addressSpace = node.addressSpace!;
    addressSpace.registerShutdownTask(() => {
        fsWatcher.close();
    });
    return node as unknown as ChangeDetector;
}
