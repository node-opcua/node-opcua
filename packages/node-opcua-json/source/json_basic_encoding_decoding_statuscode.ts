/**
 * ==========================================================================
 * Copyright (c) 2021-2026 Sterfive - etienne.rossignon@sterfive.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 * ==========================================================================
 */
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import { JsonEncoderMode104, JsonEncoderMode105, JsonEncodingScheme } from "./json_encoding_scheme.js";

export interface StatusCodeJSON {
    Code?: number | keyof StatusCodes;
    Symbol?: string;
}

export function opcuaJsonEncodeStatusCode104(
    statusCode: StatusCode,
    mode: JsonEncoderMode104
): StatusCodeJSON | number | undefined {
    /*
     * StatusCode values shall be encoded as a JSON number for the reversible encoding.
     */
    if (mode === JsonEncoderMode104.Reversible) {
        return statusCode.value;
    }
    /*
     * reference: https://reference.opcfoundation.org/Core/Part6/v104/docs/5.4.2.12
     *
     * For the non-reversible form, StatusCode values shall be encoded as a JSON object with the fields defined in Table
     *
     * Symbol The string literal associated with the numeric code encoded as JSON string.
     *
     * e.g. 0x80AB0000 has the associated literal “BadInvalidArgument”.
     * Any InfoBits in the StatusCode are ignored when looking up the symbol.
     * If the string literal is not known to the encoder the field is omitted.
     * The field is omitted in the CompactEncoding.
     * The field is omitted if the numeric code is 0 (Good).
     */

    /**
     * A StatusCode of Good (0) is treated like a NULL and not encoded.
     * (If it is an element of an JSON array it is encoded as the JSON literal ‘null’. )
     */
    if (statusCode.value === 0) {
        return undefined;
    }

    const pojo: StatusCodeJSON = {};
    // The Code is omitted if the numeric code is 0(Good).
    if (statusCode.value !== 0) {
        // The numeric code encoded as a JSON number.
        pojo.Code = statusCode.value;
    }
    // The string literal associated with the numeric code encoded as JSON string.
    // e.g. 0x80AB0000 has the associated literal “BadInvalidArgument”.
    //
    // The Symbol is omitted if the numeric code is 0(Good).
    if (statusCode.value === 0) {
        return pojo; // Good
    }
    const c = coerceStatusCode(statusCode.value & 0xffff0000); // remove InfoBits and OverflowBit
    pojo.Symbol = c.name;
    return pojo;
}

export function opcuaJsonEncodeStatusCode105(
    statusCode: StatusCode,
    mode: JsonEncoderMode105
): StatusCodeJSON | number | undefined {
    /*
     * For the non-reversible form, StatusCode values shall be encoded as a JSON object with the fields defined in Table
     *
     * Symbol The string literal associated with the numeric code encoded as JSON string.
     */

    const pojo: StatusCodeJSON = {};
    if (statusCode.value !== 0) {
        pojo.Code = statusCode.value;
    }

    /*
     * e.g. 0x80AB0000 has the associated literal “BadInvalidArgument”.
     * Any InfoBits in the StatusCode are ignored when looking up the symbol.
     * If the string literal is not known to the encoder the field is omitted.
     * The field is omitted in the CompactEncoding.
     * The field is omitted if the numeric code is 0 (Good).
     */
    if (mode === JsonEncoderMode105.Verbose) {
        if (statusCode.value !== 0) {
            const c = coerceStatusCode(statusCode.value & 0xffff0000); // remove InfoBits and OverflowBit
            if (c?.name) {
                pojo.Symbol = c.name;
            }
        }
    }
    return pojo;
}

export function opcuaJsonEncodeStatusCode(statusCode: StatusCode, scheme: JsonEncodingScheme) {
    switch (scheme) {
        case JsonEncodingScheme.DeprecatedNonReversible:
            return opcuaJsonEncodeStatusCode104(statusCode, JsonEncoderMode104.NonReversible);
        case JsonEncodingScheme.DeprecatedReversible:
            return opcuaJsonEncodeStatusCode104(statusCode, JsonEncoderMode104.Reversible);
        case JsonEncodingScheme.Compact:
            return opcuaJsonEncodeStatusCode105(statusCode, JsonEncoderMode105.Compact);
        case JsonEncodingScheme.Verbose:
            return opcuaJsonEncodeStatusCode105(statusCode, JsonEncoderMode105.Verbose);
        default:
            throw new Error("Unknown JsonEncodingScheme");
    }
}

/**
 *
 * @param pojo
 *
 * @returns
 */
export function opcuaJsonDecodeStatusCode(pojo: StatusCodeJSON | number | null | undefined): StatusCode {
    if (!pojo) {
        return StatusCodes.Good;
    }
    if (typeof pojo === "number") {
        return coerceStatusCode(pojo);
    }
    if (typeof pojo.Code === "number") {
        return coerceStatusCode(pojo.Code);
    }
    if (!pojo.Code) {
        // to trap undefined or null Code
        return StatusCodes.Good;
    }
    return coerceStatusCode(pojo.Code);
}
