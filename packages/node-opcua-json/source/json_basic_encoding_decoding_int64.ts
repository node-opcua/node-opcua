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
import type { Int64, UInt64 } from "node-opcua-basic-types";
import type { ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

const signMask = 1n << 31n;
const shiftHigh = 1n << 32n;
export function opcuaJsonEncodeInt64(value: Int64, _scheme: JsonEncodingScheme = JsonEncodingScheme.Compact): string {
    if (value instanceof BigInt) {
        return value.toString();
    }
    if (Array.isArray(value) && value.length === 2) {
        const h = BigInt(value[0]);
        const l = BigInt(value[1]);
        if ((h & signMask) === signMask) {
            const v = (h & ~signMask) * shiftHigh + l - 0x8000000000000000n;
            return v.toString();
        } else {
            const v = h * shiftHigh + l;
            return v.toString();
        }
    } else {
        return BigInt(value as unknown as number).toString();
    }
}
export function opcuaJsonEncodeUInt64(value: UInt64, _scheme: JsonEncodingScheme = JsonEncodingScheme.Compact): string {
    if (value instanceof BigInt) {
        return value.toString();
    }
    if (Array.isArray(value) && value.length === 2) {
        const h = BigInt(value[0]);
        const l = BigInt(value[1]);
        const v = h * shiftHigh + l;
        return v.toString();
    } else {
        return BigInt(value as unknown as number).toString();
    }
}

export function opcuaJsonDecodeInt64(value: string): Int64 {
    const r = BigInt(value);
    if (r >= 0) {
        return [Number(r / shiftHigh), Number(r % shiftHigh)];
    }
    const v = 0x8000000000000000n + r;
    return [Number((v / shiftHigh) | signMask), Number(v % shiftHigh)];
}

export function opcuaJsonDecodeUInt64(value: string, _builder?: ExtensionObjectBuilder, _namespaceArray?: string[]): Int64 {
    const r = BigInt(value);
    return [Number(r / shiftHigh), Number(r % shiftHigh)];
}
