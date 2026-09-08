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
import should from "should";
import { JsonEncodingScheme, opcuaJsonDecodeByteString, opcuaJsonEncodeByteString } from "../source/index.js";

describe("JSON encode ByteString", () => {
    it("should encode a ByteString - null - Verbose", () => {
        should(opcuaJsonEncodeByteString(null, JsonEncodingScheme.Verbose)).eql(null);
    });
    it("should encode a ByteString - [] - Verbose", () => {
        should(opcuaJsonEncodeByteString(Buffer.alloc(0), JsonEncodingScheme.Verbose)).eql(null);
    });
    it("should encode a ByteString - null - Compact", () => {
        should(opcuaJsonEncodeByteString(null, JsonEncodingScheme.Compact)).eql(undefined);
    });
    it("should encode a ByteString - [] - Compact", () => {
        should(opcuaJsonEncodeByteString(Buffer.alloc(0), JsonEncodingScheme.Compact)).eql(undefined);
    });
    it("should encode a ByteString", () => {
        const buffer = Buffer.from("DEADBEEF", "hex");
        should(opcuaJsonEncodeByteString(buffer, JsonEncodingScheme.Verbose)).eql("3q2+7w==");
    });
});
describe("JSON decode ByteString", () => {
    it("should decode a ByteString - null", () => {
        should(opcuaJsonDecodeByteString(null)).eql(null);
    });
    it("should decode a ByteString", () => {
        const buffer = Buffer.from("DEADBEEF", "hex");
        should(opcuaJsonDecodeByteString("3q2+7w==")?.toString("hex")).eql(buffer.toString("hex"));
    });
});
