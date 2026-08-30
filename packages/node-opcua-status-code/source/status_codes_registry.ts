/**
 * @module node-opcua-status-codes
 *
 * The one module that may import the generated status code table.
 *
 * _generated_status_codes.ts constructs 280 ConstantStatusCode instances while its own
 * module body runs, using the classes declared in opcua_status_code.ts. That makes the
 * dependency one-directional: generated -> opcua_status_code, and nothing may point back.
 *
 * It used to point back. opcua_status_code.ts imported the generated table at the foot of
 * the file, after the class declarations, and iterated it at module scope to build the
 * reverse lookup. That works under CommonJS purely because `require()` runs where it is
 * written. ESM hoists every import to the top and evaluates dependencies first, so the
 * generated module would have run before the classes it needs were initialised, and each
 * of those 280 constructions would have thrown a TDZ ReferenceError on the first
 * `import "node-opcua"`.
 *
 * Inverting it here keeps the graph linear: registry -> generated -> opcua_status_code.
 */

import { StatusCodes } from "./_generated_status_codes.js";
import type { ConstantStatusCode } from "./opcua_status_code.js";
import { _installStatusCodes, getStatusCodeFromCode, StatusCode } from "./opcua_status_code.js";

export { StatusCodes } from "./_generated_status_codes.js";

// StatusCodes is a class with one static ConstantStatusCode field per named status, plus
// makeStatusCode attached below. These types capture that dynamic shape for the casts
// that index or extend it by string key.
type IndexedStatusCodes = Record<string, ConstantStatusCode>;
type StatusCodesWithMakeStatusCode = typeof StatusCodes & { makeStatusCode: typeof StatusCode.makeStatusCode };

export function coerceStatusCode(statusCode: StatusCode | number | string | { value: number }): StatusCode {
    if (statusCode instanceof StatusCode) {
        return statusCode;
    }
    if (typeof statusCode === "object" && Object.hasOwn(statusCode, "value")) {
        return getStatusCodeFromCode(statusCode.value);
    }
    if (typeof statusCode === "number") {
        return getStatusCodeFromCode(statusCode);
    }
    const _StatusCodes = StatusCodes as unknown as IndexedStatusCodes;
    if (!_StatusCodes[statusCode as string]) {
        throw new Error(`Cannot find StatusCode ${statusCode}`);
    }
    return _StatusCodes[statusCode as string];
}

_installStatusCodes(StatusCodes as unknown as IndexedStatusCodes, StatusCodes.Bad, coerceStatusCode);

(StatusCodes as StatusCodesWithMakeStatusCode).makeStatusCode = StatusCode.makeStatusCode;
