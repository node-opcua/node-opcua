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

import { coerceQualifiedName, QualifiedName } from "node-opcua-data-model";
import should from "should";
import {
    opcuaJsonDecodeQualifiedName,
    opcuaJsonEncodeQualifiedName,
    opcuaJsonEncodeQualifiedNameAsString
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

const namespaceArray = ["n0", "n1", "n2"];
const Reversible = JsonEncodingScheme.DeprecatedReversible;
const NonReversible = JsonEncodingScheme.DeprecatedNonReversible;

///
describe("JSON encode QualifiedName v1.04", () => {
    it("QualifiedName - reversible - namespace 0 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 0 });
        should(opcuaJsonEncodeQualifiedName(name, Reversible, namespaceArray)).eql({
            Name: "A"
        });
    });
    it("QualifiedName - reversible - namespace 1 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 1 });
        should(opcuaJsonEncodeQualifiedName(name, Reversible, namespaceArray)).eql({
            Name: "A",
            Uri: 1
        });
    });
    it("QualifiedName - reversible - namespace 2 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 2 });
        should(opcuaJsonEncodeQualifiedName(name, Reversible, namespaceArray)).eql({
            Name: "A",
            Uri: 2
        });
    });
    it("QualifiedName - non-reversible - namespace 0", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 0 });
        should(opcuaJsonEncodeQualifiedName(name, NonReversible, namespaceArray)).eql({
            Name: "A"
        });
    });
    it("QualifiedName - non-reversible - namespace 1 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 1 });
        should(opcuaJsonEncodeQualifiedName(name, NonReversible, namespaceArray)).eql({
            Name: "A",
            Uri: 1
        });
    });
    it("QualifiedName - non-reversible - namespace 2 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 2 });
        should(opcuaJsonEncodeQualifiedName(name, NonReversible, namespaceArray)).eql({
            Name: "A",
            Uri: "n2"
        });
    });
});

describe("JSON decode QualifiedName", () => {
    it("should decode null as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName(null).should.eql(new QualifiedName({ name: null }));
    });
    it("should decode String as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName("abc").should.eql(new QualifiedName({ name: "abc" }));
    });
    it("should decode { Name:String} as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName({ Name: "abc" }).should.eql(new QualifiedName({ name: "abc" }));
    });
    it("should decode { Name:String, Uri:number} as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName({ Name: "abc", Uri: 10 }).should.eql(new QualifiedName({ name: "abc", namespaceIndex: 10 }));
    });
});

describe("JSON encode QualifiedName v1.05", () => {
    const namespaceArray = ["http://opc.foundation.com/UA/", "http://n1", "http://n2"];
    it("QualifiedName - reversible - namespace 0 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 0 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, Reversible, namespaceArray)).eql("A");
    });
    it("QualifiedName - reversible - namespace 1 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 1 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, Reversible, namespaceArray)).eql("nsu=http://n1;A");
    });
    it("QualifiedName - reversible - namespace 2 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 2 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, Reversible, namespaceArray)).eql("nsu=http://n2;A");
    });
    it("QualifiedName - non-reversible - namespace 0", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 0 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, NonReversible, namespaceArray)).eql("A");
    });
    it("QualifiedName - non-reversible - namespace 1 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 1 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, NonReversible, namespaceArray)).eql("nsu=http://n1;A");
    });
    it("QualifiedName - non-reversible - namespace 2 ", () => {
        const name = coerceQualifiedName({ name: "A", namespaceIndex: 2 });
        should(opcuaJsonEncodeQualifiedNameAsString(name, NonReversible, namespaceArray)).eql("nsu=http://n2;A");
    });
});

describe("JSON decode QualifiedName v1.05", () => {
    it("should decode null as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName(null, fakeBuilder, namespaceArray).should.eql(new QualifiedName({ name: null }));
    });
    it("should decode String as a QualifiedName", () => {
        opcuaJsonDecodeQualifiedName("abc", fakeBuilder, namespaceArray).should.eql(new QualifiedName({ name: "abc" }));
    });
    it("should decode 3:Hello", () => {
        opcuaJsonDecodeQualifiedName("3:Hello", fakeBuilder, namespaceArray).should.eql(
            new QualifiedName({ name: "Hello", namespaceIndex: 3 })
        );
    });
    it("should decode 3:Hello:World", () => {
        opcuaJsonDecodeQualifiedName("3:Hello:World", fakeBuilder, namespaceArray).should.eql(
            new QualifiedName({ name: "Hello:World", namespaceIndex: 3 })
        );
    });
    /**
   * 


   */
    it("should decode nsu=http://widgets.com/schemas/hello;Hello;World", () => {
        const namespaceArray = ["http://opcfoundation.org/UA/", "http://n1", "http://widgets.com/schemas/hello"];
        opcuaJsonDecodeQualifiedName("nsu=http://widgets.com/schemas/hello;Hello;World", fakeBuilder, namespaceArray).should.eql(
            new QualifiedName({ name: "Hello;World", namespaceIndex: 2 })
        );
    });
    it("should decode nsu=tag:acme.com,2023:schemas:data#off%3B;Boiler2", () => {
        const namespaceArray = [
            "http://opcfoundation.org/UA/",
            "http://n1",
            "http://widgets.com/schemas/hello",
            "tag:acme.com,2023:schemas:data#off;"
        ];
        opcuaJsonDecodeQualifiedName("nsu=tag:acme.com,2023:schemas:data#off%3B;Boiler2", fakeBuilder, namespaceArray).should.eql(
            new QualifiedName({ name: "Boiler2", namespaceIndex: 3 })
        );
    });
});
