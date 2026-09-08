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

import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { opcuaJsonDecodeStatusCode, opcuaJsonEncodeStatusCode, type StatusCodeJSON } from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

///
describe("JSON encode StatusCode 104", () => {
    it("StatusCode.Good -> Reversible", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.Good, JsonEncodingScheme.DeprecatedReversible)).eql(0);
    });

    it("StatusCode.Good -> NoReversible", () => {
        should.not.exist(opcuaJsonEncodeStatusCode(StatusCodes.Good, JsonEncodingScheme.DeprecatedNonReversible));
        should.exist(opcuaJsonEncodeStatusCode(StatusCodes.Good, JsonEncodingScheme.DeprecatedReversible));
    });
    it("StatusCode.Bad -> Reversible", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.Bad, JsonEncodingScheme.DeprecatedReversible)).eql(StatusCodes.Bad.value);
    });
    it("StatusCode.Bad -> NoReversible", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.Bad, JsonEncodingScheme.DeprecatedNonReversible)).eql({
            Code: StatusCodes.Bad.value,
            Symbol: "Bad"
        });
    });
    it("StatusCode.BadDeadbandFilterInvalid -> Reversible", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.BadDeadbandFilterInvalid, JsonEncodingScheme.DeprecatedReversible)).eql(
            StatusCodes.BadDeadbandFilterInvalid.value
        );
    });
    it("StatusCode.BadDeadbandFilterInvalid -> NoReversible", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.BadDeadbandFilterInvalid, JsonEncodingScheme.DeprecatedNonReversible)).eql({
            Code: StatusCodes.BadDeadbandFilterInvalid.value,
            Symbol: "BadDeadbandFilterInvalid"
        });
    });
});
describe("JSON decode StatusCode", () => {
    it("should decode undefined as StatusCode.Good", () => {
        opcuaJsonDecodeStatusCode(undefined).should.eql(StatusCodes.Good);
    });
    it("should decode null as StatusCode.Good", () => {
        opcuaJsonDecodeStatusCode(null).should.eql(StatusCodes.Good);
    });
    it("should decode 0 as StatusCode.Good", () => {
        opcuaJsonDecodeStatusCode(0).should.eql(StatusCodes.Good);
    });
    it("should decode 2150760448 as StatusCode.BadWaitingForInitialData", () => {
        opcuaJsonDecodeStatusCode(2150760448).should.eql(StatusCodes.BadWaitingForInitialData);
    });
    it("should decode {Code:2150760448}as StatusCode.BadWaitingForInitialData", () => {
        opcuaJsonDecodeStatusCode({ Code: 2150760448 }).should.eql(StatusCodes.BadWaitingForInitialData);
    });
    it("extra: should decode {Code:'BadWaitingForInitialData'}as StatusCode.BadWaitingForInitialData", () => {
        opcuaJsonDecodeStatusCode({
            Code: "BadWaitingForInitialData"
        } as unknown as StatusCodeJSON).should.eql(StatusCodes.BadWaitingForInitialData);
    });
});

describe("JSON encode StatusCode 105", () => {
    it("StatusCode.Good -> Compact", () => {
        const compact = opcuaJsonEncodeStatusCode(StatusCodes.Good, JsonEncodingScheme.Compact);
        should(compact).eql({});
    });

    it("StatusCode.Good -> Verbose", () => {
        const verbose = opcuaJsonEncodeStatusCode(StatusCodes.Good, JsonEncodingScheme.Verbose);
        should(verbose).eql({});
    });
    it("StatusCode.Bad -> Compact", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.Bad, JsonEncodingScheme.Compact)).eql({
            Code: StatusCodes.Bad.value
            //  Symbol: "Bad", // Note: Symbol is not present in CompactEncoding
        });
    });
    it("StatusCode.Bad -> Verbose", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.Bad, JsonEncodingScheme.Verbose)).eql({
            Code: StatusCodes.Bad.value,
            Symbol: "Bad"
        });
    });
    it("StatusCode.BadDeadbandFilterInvalid -> Compact", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.BadDeadbandFilterInvalid, JsonEncodingScheme.Compact)).eql({
            Code: StatusCodes.BadDeadbandFilterInvalid.value
            // Symbol: "BadDeadbandFilterInvalid" // Note: Symbol is not present in CompactEncoding
        });
    });
    it("StatusCode.BadDeadbandFilterInvalid -> Verbose", () => {
        should(opcuaJsonEncodeStatusCode(StatusCodes.BadDeadbandFilterInvalid, JsonEncodingScheme.Verbose)).eql({
            Code: StatusCodes.BadDeadbandFilterInvalid.value,
            Symbol: "BadDeadbandFilterInvalid"
        });
    });

    it("shoud decode an Compact StatusCode - {}", () => {
        const statusCode = opcuaJsonDecodeStatusCode({});
        statusCode.should.eql(StatusCodes.Good);
    });
    it("shoud decode an Compact StatusCode - null", () => {
        const statusCode = opcuaJsonDecodeStatusCode(null);
        statusCode.should.eql(StatusCodes.Good);
    });
    it("shoud decode an Compact StatusCode - undefined", () => {
        const statusCode = opcuaJsonDecodeStatusCode(null);
        statusCode.should.eql(StatusCodes.Good);
    });
});
