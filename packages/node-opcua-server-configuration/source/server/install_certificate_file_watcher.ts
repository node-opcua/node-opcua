import fs from "node:fs";
import path from "node:path";
import type { ITypedEventEmitter, UAObject, UAObjectEvents } from "node-opcua-address-space-base";
import { make_debugLog } from "node-opcua-debug";

const debugLog = make_debugLog("ServerConfiguration");


export interface CertificateChangeEvents extends UAObjectEvents  {
    certificateChange: () => void;
}
export function installCertificateFileWatcher(
    node: UAObject<CertificateChangeEvents>,
    certificateFile: string
): ITypedEventEmitter<CertificateChangeEvents> {
    const fileToWatch = path.basename(certificateFile);
    const fsWatcher = fs.watch(
        path.dirname(certificateFile),
        { persistent: false },
        (_eventType: "rename" | "change", filename) => {
            /** */
            if (filename === fileToWatch) {
                debugLog("filename changed = ", filename, fileToWatch);
                node.emit("certificateChange");
            }
        }
    );
    const addressSpace = node.addressSpace;
    addressSpace?.registerShutdownTask(() => {
        fsWatcher.close();
    });
    return node;
}
