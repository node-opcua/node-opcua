/**
 * @module node-opcua-debug
 */
// tslint:disable:no-var-requires
const hexy = require("hexy");
export function hexDump(buffer: Buffer | null, width = 32, maxSize = 1024): string {
    if (!buffer) {
        return "<>";
    }
    width = width || 32;
    if (buffer.length > maxSize) {
        return hexy.hexy(buffer.slice(0, maxSize), { width, format: "twos" }) + "\n .... ( " + buffer.length + ")";
    } else {
        return hexy.hexy(buffer, { width, format: "twos" });
    }
}
