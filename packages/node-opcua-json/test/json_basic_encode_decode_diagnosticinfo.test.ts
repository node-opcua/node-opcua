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
import { DiagnosticInfo } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    opcuaJsonDecodeDiagnosticInfo,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeDiagnosticInfo,
    opcuaJsonEncodeVariant,
    type VariantJSON105
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4.2.13

const { Compact, Verbose, DeprecatedReversible, DeprecatedNonReversible } = JsonEncodingScheme;

const full = new DiagnosticInfo({
    symbolicId: 1,
    namespaceURI: 2,
    locale: 3,
    localizedText: 4,
    additionalInfo: "more",
    innerStatusCode: StatusCodes.BadInternalError,
    innerDiagnosticInfo: new DiagnosticInfo({ symbolicId: 5, additionalInfo: "inner" })
});

describe("JSON encode DiagnosticInfo", () => {
    it("empty - compact is omitted", () => {
        should(opcuaJsonEncodeDiagnosticInfo(new DiagnosticInfo(), Compact)).eql(undefined);
        should(opcuaJsonEncodeDiagnosticInfo(null, Compact)).eql(undefined);
    });
    it("empty - deprecated encodings are null", () => {
        should(opcuaJsonEncodeDiagnosticInfo(new DiagnosticInfo(), DeprecatedReversible)).eql(null);
        should(opcuaJsonEncodeDiagnosticInfo(new DiagnosticInfo(), DeprecatedNonReversible)).eql(null);
    });
    it("empty - verbose keeps every field", () => {
        should(opcuaJsonEncodeDiagnosticInfo(new DiagnosticInfo(), Verbose)).eql({
            SymbolicId: -1,
            NamespaceUri: -1,
            Locale: -1,
            LocalizedText: -1,
            AdditionalInfo: null,
            InnerStatusCode: {},
            InnerDiagnosticInfo: null
        });
    });
    it("partial - compact omits default fields", () => {
        should(opcuaJsonEncodeDiagnosticInfo(new DiagnosticInfo({ symbolicId: 3, additionalInfo: "x" }), Compact)).eql({
            SymbolicId: 3,
            AdditionalInfo: "x"
        });
    });
    it("full - compact", () => {
        should(opcuaJsonEncodeDiagnosticInfo(full, Compact)).eql({
            SymbolicId: 1,
            NamespaceUri: 2,
            Locale: 3,
            LocalizedText: 4,
            AdditionalInfo: "more",
            InnerStatusCode: { Code: StatusCodes.BadInternalError.value },
            InnerDiagnosticInfo: { SymbolicId: 5, AdditionalInfo: "inner" }
        });
    });
    it("full - deprecated reversible encodes the inner status code as a number", () => {
        should(opcuaJsonEncodeDiagnosticInfo(full, DeprecatedReversible)).eql({
            SymbolicId: 1,
            NamespaceUri: 2,
            Locale: 3,
            LocalizedText: 4,
            AdditionalInfo: "more",
            InnerStatusCode: StatusCodes.BadInternalError.value,
            InnerDiagnosticInfo: { SymbolicId: 5, AdditionalInfo: "inner" }
        });
    });
    it("full - verbose adds the status code symbol", () => {
        const pojo = opcuaJsonEncodeDiagnosticInfo(full, Verbose);
        should(pojo?.InnerStatusCode).eql({ Code: StatusCodes.BadInternalError.value, Symbol: "BadInternalError" });
        should(pojo?.InnerDiagnosticInfo).eql({
            SymbolicId: 5,
            NamespaceUri: -1,
            Locale: -1,
            LocalizedText: -1,
            AdditionalInfo: "inner",
            InnerStatusCode: {},
            InnerDiagnosticInfo: null
        });
    });
});

describe("JSON decode DiagnosticInfo", () => {
    it("decodes null as an empty DiagnosticInfo", () => {
        should(opcuaJsonDecodeDiagnosticInfo(null)).eql(new DiagnosticInfo());
        should(opcuaJsonDecodeDiagnosticInfo(undefined)).eql(new DiagnosticInfo());
    });
    it("round trips through every scheme", () => {
        for (const scheme of [Compact, Verbose, DeprecatedReversible, DeprecatedNonReversible]) {
            const pojo = opcuaJsonEncodeDiagnosticInfo(full, scheme);
            const back = opcuaJsonDecodeDiagnosticInfo(pojo);
            should(back.toJSON()).eql(full.toJSON());
        }
    });
});

describe("JSON Variant with DiagnosticInfo", () => {
    it("encodes and decodes a DiagnosticInfo scalar variant", () => {
        const variant = new Variant({ dataType: DataType.DiagnosticInfo, value: full });
        const pojo = opcuaJsonEncodeVariant(variant, Verbose, []) as unknown as VariantJSON105;
        should(pojo).have.property("UaType", DataType.DiagnosticInfo);
        const back = opcuaJsonDecodeVariant(pojo, fakeBuilder, []);
        should(back.dataType).eql(DataType.DiagnosticInfo);
        should((back.value as DiagnosticInfo).toJSON()).eql(full.toJSON());
    });
});
