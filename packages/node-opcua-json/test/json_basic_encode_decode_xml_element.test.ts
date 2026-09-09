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
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    bodyDecodeFunctor,
    bodyEncodeFunctor,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeVariant,
    type VariantJSON105
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4.2.9

const { Compact, Verbose, DeprecatedReversible, DeprecatedNonReversible } = JsonEncodingScheme;
const xml = "<a><b>1</b></a>";

describe("JSON encode/decode XmlElement", () => {
    it("encodes the XML text as a JSON string in every scheme", () => {
        const encode = bodyEncodeFunctor(DataType.XmlElement);
        for (const scheme of [Compact, Verbose, DeprecatedReversible, DeprecatedNonReversible]) {
            should(encode(xml, scheme)).eql(xml);
        }
    });
    it("omits an empty XmlElement in the compact encoding only", () => {
        const encode = bodyEncodeFunctor(DataType.XmlElement);
        should(encode("", Compact)).eql(undefined);
        should(encode("", Verbose)).eql("");
    });
    it("decodes a JSON string back to the XML text", () => {
        should(bodyDecodeFunctor(DataType.XmlElement)(xml, fakeBuilder, [])).eql(xml);
    });
    it("round trips an XmlElement variant", () => {
        const variant = new Variant({ dataType: DataType.XmlElement, value: xml });
        const pojo = opcuaJsonEncodeVariant(variant, Verbose, []) as unknown as VariantJSON105;
        should(pojo).have.property("UaType", DataType.XmlElement);
        const back = opcuaJsonDecodeVariant(pojo, fakeBuilder, []);
        should(back.dataType).eql(DataType.XmlElement);
        should(back.value).eql(xml);
    });
});
