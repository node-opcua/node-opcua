/***
 * @module node-opcua-basic-types
 */
import { BinaryStream } from "node-opcua-binary-stream";

import { decodeUAString, encodeUAString, UAString } from "./string";

export function validateLocaleId(value: any): boolean {
    // TODO : check that localeID is well-formed
    // see part 3 $8.4 page 63
    return true;
}

export type LocaleId = UAString;
export function encodeLocaleId(localeId: LocaleId, stream: BinaryStream): void {
    return encodeUAString(localeId, stream);
}

export function decodeLocaleId(stream: BinaryStream): LocaleId {
    return decodeUAString(stream);
}
