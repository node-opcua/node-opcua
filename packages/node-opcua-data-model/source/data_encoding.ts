/**
 * @module node-opcua-data-model
 */
import type { QualifiedNameLike, QualifiedNameOptions } from "./qualified_name.js";

export function isDataEncoding(dataEncoding: unknown): boolean {
    return !!dataEncoding && typeof dataEncoding === "object" && typeof (dataEncoding as { name?: unknown }).name === "string";
}

const validEncoding = ["DefaultBinary", "DefaultXml", "DefaultJson"];
export function isValidDataEncoding(dataEncoding?: string | null | QualifiedNameLike): boolean {
    if (!dataEncoding) {
        return true;
    }

    if (typeof dataEncoding === "object" && Object.hasOwn(dataEncoding, "name")) {
        dataEncoding = (dataEncoding as QualifiedNameOptions).name;
    }
    if (!dataEncoding) {
        return true;
    }
    return validEncoding.indexOf(dataEncoding as string) !== -1;
}
