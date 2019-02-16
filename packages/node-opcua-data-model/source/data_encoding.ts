/**
 * @module node-opcua-data-model
 */
import { QualifiedName, QualifiedNameLike } from "./qualified_name";

export function isDataEncoding(dataEncoding: any): boolean {
    return (dataEncoding && typeof dataEncoding.name === "string");
}

const validEncoding = ["DefaultBinary", "DefaultXml"];
export function isValidDataEncoding(dataEncoding?: string | null | QualifiedNameLike): boolean {

    if (!dataEncoding) {
        return true;
    }

    if ((dataEncoding as any).name) {
        dataEncoding = (dataEncoding as QualifiedName).name;
    }
    if (dataEncoding && ((dataEncoding as any).name || (dataEncoding as any).text) ) {
        // tslint:disable:no-console
        console.log(" isValidDataEncoding => expecting a string here , not a LocalizedText or a QualifiedName ");
        return false;
    }
    if (!(dataEncoding && typeof dataEncoding === "string")) {
        return true;
    }
    return validEncoding.indexOf(dataEncoding as string) !== -1;
}
