const hexy = require("hexy");
export function hexDump(buffer: Buffer | null, width: number = 32, maxSize: number = 1024) {
    if (!buffer) {
        return "<>";
    }
    width = width || 32;
    if (buffer.length > maxSize) {
        return hexy.hexy(buffer.slice(0, maxSize), { width: width, format: "twos" }) + "\n .... ( " + buffer.length + ")";
    } else {
        return hexy.hexy(buffer, { width: width, format: "twos" });
    }
}
