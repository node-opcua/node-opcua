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

import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import should from "should";
import { opcuaJsonDecodeLocalizedText, opcuaJsonEncodeLocalizedText } from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

const Reversible = JsonEncodingScheme.DeprecatedReversible;
const NonReversible = JsonEncodingScheme.DeprecatedNonReversible;

describe("JSON encode LocalizedText", () => {
    it("LocalizedText - reversible  - empty", () => {
        should.equal(opcuaJsonEncodeLocalizedText(coerceLocalizedText(), Reversible), null);
    });

    it("LocalizedText - reversible - no locale", () => {
        should(opcuaJsonEncodeLocalizedText(coerceLocalizedText("Hello"), Reversible)).eql({ Text: "Hello" });
    });

    it("LocalizedText - reversible - locale", () => {
        should(opcuaJsonEncodeLocalizedText(coerceLocalizedText({ text: "Hallo", locale: "DE" }), Reversible)).eql({
            Text: "Hallo",
            Locale: "DE"
        });
    });
    it("LocalizedText - non reversible  - empty", () => {
        should.equal(opcuaJsonEncodeLocalizedText(coerceLocalizedText(), NonReversible), null);
    });

    it("LocalizedText - non reversible - no locale", () => {
        should(opcuaJsonEncodeLocalizedText(coerceLocalizedText("Hello"), NonReversible)).eql("Hello");
    });

    it("LocalizedText - non reversible - locale", () => {
        should(opcuaJsonEncodeLocalizedText(coerceLocalizedText({ text: "Hallo", locale: "DE" }), NonReversible)).eql("Hallo");
    });
});

describe("JSON decode LocalizedText", () => {
    it("should decode null as an empty localizedText", () => {
        opcuaJsonDecodeLocalizedText(null).should.eql(new LocalizedText({ text: null, locale: null }));
    });
    it("should decode a String as an empty localizedText", () => {
        opcuaJsonDecodeLocalizedText("Hello World").should.eql(new LocalizedText({ text: "Hello World", locale: null }));
    });
    it("should decode a { Text:String } as an empty localizedText", () => {
        opcuaJsonDecodeLocalizedText({ Text: "Hello World" }).should.eql(new LocalizedText({ text: "Hello World", locale: null }));
    });
    it("should decode a { Text:String, Locale:String } as an empty localizedText", () => {
        opcuaJsonDecodeLocalizedText({
            Text: "Hello World",
            Locale: "en"
        }).should.eql(new LocalizedText({ text: "Hello World", locale: "en" }));
    });
});
