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

// Structures with optional fields in each JSON encoding: 1.04 Table 33, 1.05 clause 5.4.7 and
// Tables 46, 47. AccessResult of OPC UA for AutoID: CodeType (bit 0), Identifier (bit 1) and
// Timestamp (bit 2) are all optional.

import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    type ExtensionObjectBuilder,
    type ExtensionObjectConstructorFuncWithSchema,
    type ExtensionObjectJSON,
    opcuaJsonDecodeExtensionObject,
    opcuaJsonEncodeExtensionObjectBody
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";

type AccessResult = ExtensionObject & { codeType?: string; timestamp?: Date };

describe("JSON Structure with optional fields per encoding (AccessResult of OPC UA for AutoID)", function (this: Mocha.Suite) {
    this.timeout(20000);
    let addressSpace: AddressSpace;
    let accessResultTypeId: NodeId;
    let builder: ExtensionObjectBuilder;
    const accessResult = (options: Record<string, unknown>) =>
        addressSpace.constructExtensionObject(accessResultTypeId, options) as AccessResult;
    const typeId = () => `ns=${accessResultTypeId.namespace};i=${accessResultTypeId.value}`;
    const decode = (json: Record<string, unknown>) =>
        opcuaJsonDecodeExtensionObject({ UaTypeId: typeId(), ...json } as ExtensionObjectJSON, builder, []) as AccessResult;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);
        const ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        const dataType = addressSpace.findDataType("AccessResult", ns);
        if (!dataType) throw new Error("AccessResult not found");
        accessResultTypeId = dataType.nodeId;
        builder = {
            getExtensionObjectConstructor: (dataTypeNodeId: NodeId) =>
                addressSpace.getExtensionObjectConstructor(dataTypeNodeId) as ExtensionObjectConstructorFuncWithSchema
        };
    });
    after(() => {
        addressSpace.dispose();
    });

    describe("encode, with only CodeType present", () => {
        it("1.04 Reversible: EncodingMask and the present fields (1.04 Table 33)", () => {
            should(
                opcuaJsonEncodeExtensionObjectBody(accessResult({ codeType: "EPC" }), JsonEncodingScheme.DeprecatedReversible, [])
            ).eql({ EncodingMask: 1, CodeType: "EPC" });
        });
        it("1.04 NonReversible: like a Structure, no EncodingMask", () => {
            should(
                opcuaJsonEncodeExtensionObjectBody(
                    accessResult({ codeType: "EPC" }),
                    JsonEncodingScheme.DeprecatedNonReversible,
                    []
                )
            ).eql({ CodeType: "EPC" });
        });
        it("1.05 Compact: EncodingMask and the present fields (5.4.7, Table 46)", () => {
            should(opcuaJsonEncodeExtensionObjectBody(accessResult({ codeType: "EPC" }), JsonEncodingScheme.Compact, [])).eql({
                EncodingMask: 1,
                CodeType: "EPC"
            });
        });
        it("1.05 Verbose: the present fields, no EncodingMask (5.4.7)", () => {
            should(opcuaJsonEncodeExtensionObjectBody(accessResult({ codeType: "EPC" }), JsonEncodingScheme.Verbose, [])).eql({
                CodeType: "EPC"
            });
        });
    });

    describe("an optional field present with its default value", () => {
        it("1.05 Compact keeps its bit in the EncodingMask although the field is omitted (Table 47)", () => {
            should(opcuaJsonEncodeExtensionObjectBody(accessResult({ codeType: "" }), JsonEncodingScheme.Compact, [])).eql({
                EncodingMask: 1
            });
        });
        it("is decoded as present, with its default value", () => {
            const back = decode({ EncodingMask: 1 });
            should(back.codeType).eql("");
        });
    });

    describe("decode", () => {
        it("a field whose bit is clear is absent, even if the JSON has it", () => {
            should(decode({ EncodingMask: 0, CodeType: "EPC" }).codeType).be.undefined();
        });
        it("without EncodingMask (Verbose, or earlier versions), a field is present when its name is", () => {
            should(decode({ CodeType: "EPC" }).codeType).eql("EPC");
            should(decode({}).codeType).be.undefined();
        });
    });

    for (const scheme of [
        JsonEncodingScheme.DeprecatedReversible,
        JsonEncodingScheme.Compact,
        JsonEncodingScheme.Verbose
    ] as const) {
        it(`round-trips present and absent fields through ${JsonEncodingScheme[scheme]}`, () => {
            const timestamp = new Date(Date.UTC(2026, 9, 19));
            const body = opcuaJsonEncodeExtensionObjectBody(accessResult({ codeType: "", timestamp }), scheme, []);
            const back = decode(JSON.parse(JSON.stringify(body ?? {})));
            should(back.codeType).eql("");
            should(back.timestamp?.getTime()).eql(timestamp.getTime());
        });
    }
});
