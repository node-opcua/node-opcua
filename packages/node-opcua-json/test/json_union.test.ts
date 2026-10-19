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

// Unions in each JSON encoding: 1.04 Table 34 and Annex H.10, 1.05 clause 5.4.8 and Table 48.
// The ScanData union of OPC UA for AutoID: 1 ByteString, 2 String, 3 Epc, 4 Custom.

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
    opcuaJsonEncodeExtensionObject
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";

describe("JSON Union per encoding (ScanData of OPC UA for AutoID)", function (this: Mocha.Suite) {
    this.timeout(20000);
    let addressSpace: AddressSpace;
    let scanDataTypeId: NodeId;
    let builder: ExtensionObjectBuilder;
    const scanData = (options: Record<string, unknown>) =>
        addressSpace.constructExtensionObject(scanDataTypeId, options) as ExtensionObject & {
            switchField: number;
            string?: string;
        };

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);
        const ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        const dataType = addressSpace.findDataType("ScanData", ns);
        if (!dataType) throw new Error("ScanData not found");
        scanDataTypeId = dataType.nodeId;
        builder = {
            getExtensionObjectConstructor: (dataTypeNodeId: NodeId) =>
                addressSpace.getExtensionObjectConstructor(dataTypeNodeId) as ExtensionObjectConstructorFuncWithSchema
        };
    });
    after(() => {
        addressSpace.dispose();
    });

    const typeId = () => `ns=${scanDataTypeId.namespace};i=${scanDataTypeId.value}`;

    describe('encode a union holding String "hello" (switch 2)', () => {
        it("1.04 Reversible: { SwitchField, Value } (Table 34)", () => {
            const json = opcuaJsonEncodeExtensionObject(scanData({ string: "hello" }), JsonEncodingScheme.DeprecatedReversible, []);
            should(json).eql({
                TypeId: { Id: scanDataTypeId.value, Namespace: scanDataTypeId.namespace },
                Body: { SwitchField: 2, Value: "hello" }
            });
        });
        it("1.04 NonReversible: the value of the selected field (Annex H.10)", () => {
            should(
                opcuaJsonEncodeExtensionObject(scanData({ string: "hello" }), JsonEncodingScheme.DeprecatedNonReversible, [])
            ).eql("hello");
        });
        it("1.05 Compact: { SwitchField, <FieldName> } (5.4.8)", () => {
            should(opcuaJsonEncodeExtensionObject(scanData({ string: "hello" }), JsonEncodingScheme.Compact, [])).eql({
                UaTypeId: typeId(),
                SwitchField: 2,
                String: "hello"
            });
        });
        it("1.05 Verbose: { <FieldName> } (5.4.8)", () => {
            should(opcuaJsonEncodeExtensionObject(scanData({ string: "hello" }), JsonEncodingScheme.Verbose, [])).eql({
                UaTypeId: typeId(),
                String: "hello"
            });
        });
    });

    describe("encode a union with no field selected (switch 0)", () => {
        it("1.04 NonReversible: null (Annex H.10)", () => {
            should(opcuaJsonEncodeExtensionObject(scanData({}), JsonEncodingScheme.DeprecatedNonReversible, [])).eql(null);
        });
        it("1.05 Verbose: an empty object (5.4.8)", () => {
            should(opcuaJsonEncodeExtensionObject(scanData({}), JsonEncodingScheme.Verbose, [])).eql({ UaTypeId: typeId() });
        });
    });

    describe("decode every form", () => {
        const decode = (json: unknown) =>
            opcuaJsonDecodeExtensionObject(json as ExtensionObjectJSON, builder, []) as ExtensionObject & {
                switchField: number;
                string?: string;
            };
        it("1.05 Verbose { String }", () => {
            const back = decode({ UaTypeId: typeId(), String: "hello" });
            should(back.switchField).eql(2);
            should(back.string).eql("hello");
        });
        it("1.05 Compact { SwitchField, String }", () => {
            const back = decode({ UaTypeId: typeId(), SwitchField: 2, String: "hello" });
            should(back.switchField).eql(2);
            should(back.string).eql("hello");
        });
        it("{ SwitchField, Value }, as 1.04 and earlier node-opcua 1.05 wrote it", () => {
            should(
                decode({
                    TypeId: { Id: scanDataTypeId.value, Namespace: scanDataTypeId.namespace },
                    Body: { SwitchField: 2, Value: "hello" }
                }).string
            ).eql("hello");
            should(decode({ UaTypeId: typeId(), UaBody: { SwitchField: 2, Value: "hello" } }).string).eql("hello");
        });
        it("{} is the union with no field selected", () => {
            should(decode({ UaTypeId: typeId() }).switchField).eql(0);
        });
    });

    for (const scheme of [
        JsonEncodingScheme.DeprecatedReversible,
        JsonEncodingScheme.Compact,
        JsonEncodingScheme.Verbose
    ] as const) {
        it(`round-trips through ${JsonEncodingScheme[scheme]}`, () => {
            const json = JSON.parse(JSON.stringify(opcuaJsonEncodeExtensionObject(scanData({ string: "hello" }), scheme, [])));
            const back = opcuaJsonDecodeExtensionObject(json, builder, []) as ExtensionObject & {
                switchField: number;
                string?: string;
            };
            should(back.switchField).eql(2);
            should(back.string).eql("hello");
        });
    }
});
