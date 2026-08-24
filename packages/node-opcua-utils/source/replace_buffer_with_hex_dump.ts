/**
 * @module node-opcua-utils
 */
export function replaceBufferWithHexDump(
    obj: Record<string, { toString(format: string): void }>
): Record<string, { toString(format: string): void }> {
    for (const p in obj) {
        if (Object.hasOwn(obj, p)) {
            if (obj[p] instanceof Buffer) {
                obj[p] = `<BUFFER>${obj[p].toString("hex")}</BUFFER>`;
            } else if (typeof obj[p] === "object") {
                replaceBufferWithHexDump(obj[p]);
            }
        }
    }
    return obj;
}
