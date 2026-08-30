/**
 * @module node-opcua-utils
 */
export type HexDumpable = Record<string, unknown>;

export function replaceBufferWithHexDump(obj: HexDumpable): HexDumpable {
    for (const p in obj) {
        if (Object.hasOwn(obj, p)) {
            const value = obj[p];
            if (value instanceof Buffer) {
                obj[p] = `<BUFFER>${value.toString("hex")}</BUFFER>`;
            } else if (typeof value === "object" && value !== null) {
                replaceBufferWithHexDump(value as HexDumpable);
            }
        }
    }
    return obj;
}
