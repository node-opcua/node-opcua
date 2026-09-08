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
import type { ByteString } from "node-opcua-basic-types";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

export function opcuaJsonEncodeByteString(
    byteString: ByteString | null,
    scheme: JsonEncodingScheme,
    _namespaceArray?: string[]
): string | null | undefined {
    if (!byteString) {
        if (scheme === JsonEncodingScheme.Compact) {
            return undefined; // Compact encoding does not encode null values
        }
        return null;
    }
    if (scheme === JsonEncodingScheme.Compact && byteString.length === 0) {
        return undefined; // Compact encoding does not encode empty ByteString
    }
    if (scheme === JsonEncodingScheme.Verbose && byteString.length === 0) {
        return null;
    }
    return byteString.toString("base64");
}

export function opcuaJsonDecodeByteString(pojo: string | null): Buffer | null {
    if (!pojo) {
        return null;
    }
    return Buffer.from(pojo, "base64");
}
