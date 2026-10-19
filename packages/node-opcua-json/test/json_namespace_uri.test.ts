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

// OPC UA JSON 1.05 names every namespace by its URI, so that a payload does not depend on the
// NamespaceArray of the server it came from (Part 6 1.05 clauses 5.1.12, 5.4.2.10, 5.4.2.11, 5.4.2.14).

import { QualifiedName } from "node-opcua-data-model";
import { coerceNodeId, ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { Argument, RelativePath } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    opcuaJsonDecodeExpandedNodeId,
    opcuaJsonDecodeNodeId,
    opcuaJsonDecodeQualifiedName,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeExpandedNodeId,
    opcuaJsonEncodeVariant
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// the same namespace sits at index 1 on server A and at index 2 on server B
const serverA = ["http://opcfoundation.org/UA/", "urn:acme"];
const serverB = ["http://opcfoundation.org/UA/", "urn:other", "urn:acme"];

type Json = Record<string, unknown> & { Value: Record<string, unknown> & { UaBody: Record<string, unknown> } };

function argumentVariant() {
    return new Variant({
        dataType: DataType.ExtensionObject,
        value: new Argument({ name: "Speed", dataType: coerceNodeId("ns=1;i=5000"), valueRank: -1 })
    });
}
function relativePathVariant() {
    return new Variant({
        dataType: DataType.ExtensionObject,
        value: new RelativePath({
            elements: [
                {
                    referenceTypeId: coerceNodeId("ns=1;i=7"),
                    isInverse: false,
                    includeSubtypes: true,
                    targetName: new QualifiedName({ namespaceIndex: 1, name: "Pump" })
                }
            ]
        })
    });
}
function qualifiedNameVariant(namespaceIndex: number, name: string) {
    return new Variant({ dataType: DataType.QualifiedName, value: new QualifiedName({ namespaceIndex, name }) });
}

for (const scheme of [JsonEncodingScheme.Compact, JsonEncodingScheme.Verbose] as const) {
    describe(`JSON ${JsonEncodingScheme[scheme]} (1.05) writes every namespace as a URI`, () => {
        it("a NodeId field of a structure", () => {
            const json = opcuaJsonEncodeVariant(argumentVariant(), scheme, serverA) as Json;
            should(json.Value.UaBody.DataType).eql("nsu=urn:acme;i=5000");
        });

        it("a NodeId and a QualifiedName in a structure nested in a structure", () => {
            const json = opcuaJsonEncodeVariant(relativePathVariant(), scheme, serverA) as Json;
            const element = (json.Value.UaBody.Elements as Record<string, unknown>[])[0];
            should(element.ReferenceTypeId).eql("nsu=urn:acme;i=7");
            should(element.TargetName).eql("nsu=urn:acme;Pump");
        });

        it("a QualifiedName as a JSON string (5.4.2.14)", () => {
            should(opcuaJsonEncodeVariant(qualifiedNameVariant(1, "Pump"), scheme, serverA)).eql({
                UaType: DataType.QualifiedName,
                Value: "nsu=urn:acme;Pump"
            });
        });

        it("a QualifiedName of namespace 0, without prefix, and not dropped", () => {
            should(opcuaJsonEncodeVariant(qualifiedNameVariant(0, "Pump"), scheme, serverA)).eql({
                UaType: DataType.QualifiedName,
                Value: "Pump"
            });
        });

        it("a QualifiedName whose index has no URI, with the <short-index> form", () => {
            should(opcuaJsonEncodeVariant(qualifiedNameVariant(5, "Pump"), scheme, serverA)).eql({
                UaType: DataType.QualifiedName,
                Value: "5:Pump"
            });
        });

        it("a payload from server A lands on the right indexes of server B", () => {
            const builder = fakeBuilder;
            const argument = opcuaJsonDecodeVariant(
                JSON.parse(JSON.stringify(opcuaJsonEncodeVariant(argumentVariant(), scheme, serverA))),
                builder,
                serverB
            );
            should((argument.value as Argument).dataType.toString()).eql("ns=2;i=5000");

            const path = opcuaJsonDecodeVariant(
                JSON.parse(JSON.stringify(opcuaJsonEncodeVariant(relativePathVariant(), scheme, serverA))),
                builder,
                serverB
            );
            const element = (path.value as RelativePath).elements?.[0];
            should(element?.referenceTypeId.toString()).eql("ns=2;i=7");
            should(element?.targetName.toString()).eql("2:Pump");

            const name = opcuaJsonDecodeVariant(
                JSON.parse(JSON.stringify(opcuaJsonEncodeVariant(qualifiedNameVariant(1, "Pump"), scheme, serverA))),
                builder,
                serverB
            );
            should((name.value as QualifiedName).toString()).eql("2:Pump");
        });
    });
}

describe("JSON 1.05 decoder and a namespace URI it cannot map", () => {
    it("NodeId: NamespaceIndex 0, IdType String, Identifier the JSON string (5.4.2.10)", () => {
        const nodeId = opcuaJsonDecodeNodeId("nsu=urn:nobody;i=1", fakeBuilder, serverA);
        should(nodeId.namespace).eql(0);
        should(nodeId.identifierType).eql(NodeIdType.STRING);
        should(nodeId.value).eql("nsu=urn:nobody;i=1");
    });

    it("NodeId: without a NamespaceArray, the URI cannot be mapped either", () => {
        const nodeId = opcuaJsonDecodeNodeId("nsu=urn:nobody;i=1");
        should(nodeId).eql(new NodeId(NodeIdType.STRING, "nsu=urn:nobody;i=1", 0));
    });

    it("NodeId: the OPC UA namespace URI is always index 0", () => {
        should(opcuaJsonDecodeNodeId("nsu=http://opcfoundation.org/UA/;i=85").toString()).eql("ns=0;i=85");
    });

    it("QualifiedName: NamespaceIndex 0 and the raw JSON string as Name (5.4.2.14)", () => {
        const name = opcuaJsonDecodeQualifiedName("nsu=urn:nobody;Pump", fakeBuilder, serverA);
        should(name.namespaceIndex).eql(0);
        should(name.name).eql("nsu=urn:nobody;Pump");
    });

    it("ExpandedNodeId: the URI is kept in the NamespaceUri field (5.4.2.11)", () => {
        const expanded = opcuaJsonDecodeExpandedNodeId("nsu=urn:nobody;i=1", fakeBuilder, serverA);
        should(expanded.namespaceUri).eql("urn:nobody");
        should(expanded.namespace).eql(0);
        should(expanded.identifierType).eql(NodeIdType.NUMERIC);
        should(expanded.value).eql(1);
    });

    it("ExpandedNodeId: a known URI is replaced by its index", () => {
        const expanded = opcuaJsonDecodeExpandedNodeId("nsu=urn:acme;i=1", fakeBuilder, serverB);
        should(expanded.namespaceUri).eql(null);
        should(expanded.toString()).eql("ns=2;i=1");
    });
});

describe("JSON 1.05 encoder and the NamespaceUri of an ExpandedNodeId", () => {
    for (const scheme of [JsonEncodingScheme.Compact, JsonEncodingScheme.Verbose] as const) {
        it(`writes the NamespaceUri as nsu=, not as the server URI - ${JsonEncodingScheme[scheme]}`, () => {
            const expanded = ExpandedNodeId.fromNodeId(coerceNodeId("ns=2;i=1"), "urn:acme", 0);
            should(opcuaJsonEncodeExpandedNodeId(expanded, scheme, serverA)).eql("nsu=urn:acme;i=1");
        });
        it(`writes a ServerIndex as svr= - ${JsonEncodingScheme[scheme]}`, () => {
            const expanded = ExpandedNodeId.fromNodeId(coerceNodeId("ns=1;i=1"), undefined, 3);
            should(opcuaJsonEncodeExpandedNodeId(expanded, scheme, serverA)).eql("svr=3;nsu=urn:acme;i=1");
        });
    }
});
