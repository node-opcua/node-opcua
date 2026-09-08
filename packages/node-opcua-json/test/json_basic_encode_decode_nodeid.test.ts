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
import { coerceNodeId, ExpandedNodeId } from "node-opcua-nodeid";
import should from "should";
import {
    opcuaJsonDecodeNodeId,
    opcuaJsonEncodeExpandedNodeId,
    opcuaJsonEncodeNodeId,
    opcuaJsonEncodeNodeIdAsString
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

const namespaceArray = ["n0", "n1", "n2"];
const Reversible = JsonEncodingScheme.DeprecatedReversible;
const NonReversible = JsonEncodingScheme.DeprecatedNonReversible;

describe("JSON encode NodeId - 104", () => {
    it("should encode a nodeId - Integer", () => {
        const nodeId = coerceNodeId("ns=0;i=1");
        should(opcuaJsonEncodeNodeId(nodeId, JsonEncodingScheme.DeprecatedReversible)).eql({ Id: 1 });
    });
    it("should encode a nodeId - String", () => {
        const nodeId = coerceNodeId("ns=0;s=SomeString");
        should(opcuaJsonEncodeNodeId(nodeId, JsonEncodingScheme.DeprecatedReversible)).eql({ IdType: 1, Id: "SomeString" });
    });
    it("should encode a nodeId - String", () => {
        const nodeId = coerceNodeId('ns=0;s="SomeString"."SomeOtherString"');
        should(opcuaJsonEncodeNodeId(nodeId, JsonEncodingScheme.DeprecatedReversible)).eql({
            IdType: 1,
            Id: '"SomeString"."SomeOtherString"'
        });
    });
    it("should encode a nodeId - Guid", () => {
        const nodeId = coerceNodeId("ns=0;g=41a54988-ceab-4151-84ae-32cc61bd41cc");
        should(opcuaJsonEncodeNodeId(nodeId, JsonEncodingScheme.DeprecatedReversible)).eql({
            IdType: 2,
            Id: "41A54988-CEAB-4151-84AE-32CC61BD41CC"
        });
    });
    it("should encode a nodeId - Opaque(ByteString", () => {
        const nodeId = coerceNodeId("ns=0;b=3q2+7w==");
        should(opcuaJsonEncodeNodeId(nodeId, Reversible)).eql({
            IdType: 3,
            Id: Buffer.from("DEADBEEF", "hex").toString("base64")
        });
    });
    it("should encode a nodeId - Namespace 1 - non-reversible", () => {
        const nodeId = coerceNodeId("ns=1;i=42");
        should(opcuaJsonEncodeNodeId(nodeId, NonReversible)).eql({
            Id: 42,
            Namespace: 1
        });
    });
    it("should encode a nodeId - Namespace 1 - reversible", () => {
        const nodeId = coerceNodeId("ns=1;i=42");
        should(opcuaJsonEncodeNodeId(nodeId, Reversible, namespaceArray)).eql({
            Id: 42,
            Namespace: 1
        });
    });
    it("should encode a nodeId - Namespace 2 - non-reversible", () => {
        const nodeId = coerceNodeId("ns=2;i=42");
        should(opcuaJsonEncodeNodeId(nodeId, NonReversible, namespaceArray)).eql({
            Id: 42,
            Namespace: "n2"
        });
    });
    it("should encode a nodeId - Namespace 2 - reversible", () => {
        const nodeId = coerceNodeId("ns=2;i=42");
        should(opcuaJsonEncodeNodeId(nodeId, Reversible, namespaceArray)).eql({
            Id: 42,
            Namespace: 2
        });
    });
});

describe("JSON encode NodeId - 105", () => {
    const namespaceArray: string[] = ["http://opcfoundation.org/UA/", "n1;", "n2"];
    (
        [
            { nodeId: "ns=0;i=1", expected: "i=1", expectedCompact: "i=1" },
            { nodeId: "ns=0;i=0", expected: "i=0", expectedCompact: "undefined" },
            { nodeId: "ns=0;s=SomeString", expected: "s=SomeString" },
            {
                nodeId: 'ns=0;s="SomeString"."SomeOtherString"',
                expected: 's="SomeString"."SomeOtherString"'
            },
            {
                nodeId: "ns=0;g=41a54988-ceab-4151-84ae-32cc61bd41cc",
                expected: "g=41A54988-CEAB-4151-84AE-32CC61BD41CC"
            },
            {
                nodeId: "ns=0;b=3q2+7w==",
                expected: `b=${Buffer.from("DEADBEEF", "hex").toString("base64")}`
            },
            { nodeId: "ns=1;i=42", expected: "nsu=n1%3B;i=42" },
            { nodeId: "ns=2;i=42", expected: "nsu=n2;i=42" }
        ] as { nodeId: string; expected: string; expectedCompact?: string }[]
    ).forEach(({ nodeId, expected, expectedCompact }) => {
        it(`should encode ${nodeId} as ${JSON.stringify(expected)} - Verbose`, () => {
            const encoded = opcuaJsonEncodeNodeId(coerceNodeId(nodeId), JsonEncodingScheme.Verbose, namespaceArray);
            should(encoded).eql(expected);
        });
        it(`should encode ${nodeId} as ${JSON.stringify(expectedCompact || expected)} - Compact`, () => {
            const encoded = opcuaJsonEncodeNodeId(coerceNodeId(nodeId), JsonEncodingScheme.Compact, namespaceArray);
            expected = expectedCompact || expected;
            if (expected === "undefined") {
                should(encoded).be.undefined();
            } else {
                should(encoded).eql(expected);
            }
        });
    });
});

describe("JSON encode ExpandedNodeId - 105", () => {
    [
        {
            expandedNodeId: ExpandedNodeId.fromNodeId(coerceNodeId("ns=0;i=1")),
            expected: "i=1"
        },
        {
            expandedNodeId: ExpandedNodeId.fromNodeId(coerceNodeId("ns=2;i=1"), "http://hello;A", 3),
            expected: "svu=http://hello%3BA;ns=2;i=1"
        }
    ].forEach(({ expandedNodeId, expected }) => {
        it(`should encode ExpandedNodeId ${expandedNodeId.toString()} as ${JSON.stringify(expected)} - Verbose`, () => {
            const encoded = opcuaJsonEncodeExpandedNodeId(expandedNodeId, JsonEncodingScheme.Verbose);
            should(encoded).eql(expected);
        });
        it(`should encode ExpandedNodeId ${expandedNodeId.toString()} as ${JSON.stringify(expected)} - Compact`, () => {
            const encoded = opcuaJsonEncodeExpandedNodeId(expandedNodeId, JsonEncodingScheme.Compact);
            should(encoded).eql(expected);
        });
    });
});

describe("JSON decode NodeId", () => {
    it("should encode a nodeId - Integer", () => {
        opcuaJsonDecodeNodeId({ Id: 1 }).toString().should.eql("ns=0;i=1");
        opcuaJsonDecodeNodeId({ Id: "1" }).toString().should.eql("ns=0;i=1");
    });
    it("should encode a nodeId - String and namespace ", () => {
        opcuaJsonDecodeNodeId({ Id: "ABCD", Namespace: 32, IdType: 1 }).toString().should.eql("ns=32;s=ABCD");
    });
    it("should encode a nodeId - Guid and namespace ", () => {
        opcuaJsonDecodeNodeId({
            Id: "41a54988-ceab-4151-84ae-32cc61bd41cc",
            Namespace: 32,
            IdType: 2
        })
            .toString()
            .should.eql("ns=32;g=41A54988-CEAB-4151-84AE-32CC61BD41CC");
    });
    it("should encode a nodeId - ByteString and namespace ", () => {
        const deadbeef = Buffer.from("DEADBEEF", "hex");
        const deadBeefInBase64 = deadbeef.toString("base64");
        opcuaJsonDecodeNodeId({ Id: deadBeefInBase64, Namespace: 32, IdType: 3 })
            .toString()
            .should.eql(`ns=32;b=${deadBeefInBase64}`);
    });
    it("should encode a nodeId - Integer - with namespace ", () => {
        const namespaces = ["n0", "n1", "n2"];
        opcuaJsonDecodeNodeId({ Id: 1, Namespace: "n2" }, fakeBuilder, namespaces).toString().should.eql("ns=2;i=1");
        opcuaJsonDecodeNodeId({ Id: 1, Namespace: "n2" }, fakeBuilder, undefined).toString().should.eql("ns=65535;i=1");
        opcuaJsonDecodeNodeId({ Id: 1, Namespace: "n3" }, fakeBuilder, namespaces).toString().should.eql("ns=65535;i=1");
    });

    [
        "i=13",
        "nsu=http://widgets.com/schemas/hello;s=水 World",
        "g=09087E75-8E5E-499B-954F-F2A9603DB28A",
        "nsu=tag:acme.com,2023:schemas:data#off%3B;b=M/RbKBsRVkePCePcx24oRA=="
    ].forEach((nodeIdAsString) => {
        it(`should decode a simple nodeId - ${nodeIdAsString}`, () => {
            //
            const namespaceArray: string[] = [];
            namespaceArray[0] = "http://opcfoundation.org/UA/";
            namespaceArray[1] = "http://opcfoundation.org/UA/DI/";
            namespaceArray[2] = "http://opcfoundation.org/UA/AutoID/";
            namespaceArray[3] = "tag:acme.com,2023:schemas:data#off;"; // note the ; in the url

            namespaceArray[10] = "http://widgets.com/schemas/hello";
            const decodedNodeId = opcuaJsonDecodeNodeId(nodeIdAsString, fakeBuilder, namespaceArray);
            opcuaJsonEncodeNodeIdAsString(decodedNodeId, namespaceArray).should.eql(nodeIdAsString);
        });
    });

    // The first abnormal state occurs when the encoder cannot map a NamespaceIndex to a NamespaceUri.
    // In this case, the encoder shall encode the NamespaceIndex using the <namespace-index> form.
    // The decoder shall pass this NamespaceIndex to the application.
    it("should encode a nodeId when the namespace is not defined", () => {
        const namespaceArray: string[] = ["n0", "n1", "n2"];
        const nodeId = coerceNodeId("ns=10;i=12345"); // namespace index 10 is not defined
        opcuaJsonEncodeNodeIdAsString(nodeId, namespaceArray).should.eql("ns=10;i=12345");
    });
    // The second abnormal state occurs when the decoder cannot convert a NamespaceUri to a NamespaceIndex.
    // If this occurs the decoder shall set the NamespaceIndex to 0, the IdType to String and the Identifier to the JSON string.
    it("should decode a nodeId when the namespace is not defined", () => {
        const namespaceArray: string[] = ["n0", "n1", "n2"];
        const nodeIdAsString = "nsu=http://unknownUri;i=12345";
        opcuaJsonDecodeNodeId(nodeIdAsString, fakeBuilder, namespaceArray).toString().should.eql("ns=0;i=12345");
    });

    // "ns=10;i=12345",
    // "g=09087e75-8e5e-499b-954f-f2a9603db28a",

    // https://reference.opcfoundation.org/Core/Part6/v105/docs/5.1.12#_Ref122651839
    [
        "i=13",
        "svr=1;nsu=http://widgets.com/schemas/hello;s=水 World",
        "svu=http://smith.com/east/factory;g=09087e75-8e5e-499b-954f-f2a9603db28a",
        "svu=http://smith.com/west/factory;nsu=tag:acme.com,2023:schemas:data#off%3B;b=M/RbKBsRVkePCePcx24oRA==i"
    ].forEach((nodeId) => {
        it.skip(`should decode a expanded nodeId - ${nodeId}`, () => {});
    });
});
