/**
 * @module node-opcua-data-model
 */
import { QualifiedName, QualifiedNameLike, QualifiedNameOptions } from "./qualified_name";

export function isDataEncoding(dataEncoding: any): boolean {
    return dataEncoding && typeof dataEncoding.name === "string";
}

const validEncoding = ["DefaultBinary", "DefaultXml", "DefaultJson"];
export function isValidDataEncoding(dataEncoding?: string | null | QualifiedNameLike): boolean {
    if (!dataEncoding) {
        return true;
    }

    if ((dataEncoding as any).hasOwnProperty("name")) {
        dataEncoding = (dataEncoding as QualifiedNameOptions).name;
    }
    if (!dataEncoding) {
        return true;
    }
    return validEncoding.indexOf(dataEncoding as string) !== -1;
}
