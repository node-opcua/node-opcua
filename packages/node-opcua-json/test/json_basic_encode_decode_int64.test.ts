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
import "should";

import { opcuaJsonDecodeInt64, opcuaJsonDecodeUInt64, opcuaJsonEncodeInt64, opcuaJsonEncodeUInt64 } from "../source/index.js";
import { fakeBuilder } from "./helper.js";

function coerceInt64_b(n: number | number[]) {
    const nb = Array.isArray(n) ? BigInt(n[0]) * 2n ** 32n + BigInt(n[1]) : BigInt(n);
    const b = new BigInt64Array(1);
    b[0] = nb;
    // console.log(Buffer.from(b.buffer).toString("hex"));
    const bb = new Uint32Array(b.buffer);
    return [bb[1], bb[0]];
}

describe("JSON encode Int64/UInt64", () => {
    it("should encode a Int64", () => {
        opcuaJsonEncodeInt64(coerceInt64_b([1, 0])).should.eql("4294967296");
        opcuaJsonEncodeInt64(coerceInt64_b([0, 1])).should.eql("1");
        opcuaJsonEncodeInt64(coerceInt64_b(-1)).should.eql("-1");
        opcuaJsonEncodeInt64(coerceInt64_b(-2)).should.eql("-2");
        opcuaJsonEncodeInt64(coerceInt64_b(-256)).should.eql("-256");
        opcuaJsonEncodeInt64(coerceInt64_b(-54321)).should.eql("-54321");
        opcuaJsonEncodeInt64(coerceInt64_b(-4294836226)).should.eql("-4294836226");
    });
    it("should encode a UInt64", () => {
        opcuaJsonEncodeUInt64(coerceInt64_b([1, 0])).should.eql("4294967296");
        opcuaJsonEncodeUInt64(coerceInt64_b([0, 1])).should.eql("1");
        opcuaJsonEncodeUInt64(coerceInt64_b(0xffffffffffff)).should.eql("281474976710655");
    });
});

describe("JSON decode Int64/UInt64", () => {
    it("should decode a UInt64", () => {
        opcuaJsonDecodeUInt64("281474976710655", fakeBuilder, []).should.eql([0x0000ffff, 0xffffffff]);
    });
    it("should decode a Int64", () => {
        opcuaJsonDecodeInt64("281474976710655").should.eql([0x0000ffff, 0xffffffff]);
        opcuaJsonDecodeInt64("-1").should.eql([0xffffffff, 0xffffffff]);
    });
});
