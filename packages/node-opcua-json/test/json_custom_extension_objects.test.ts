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

import util from "node:util";
import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import type { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import type { ExtensionObjectConstructorFuncWithSchema } from "../source/extension_object_constructor.js";
import { type ExtensionObjectJSON, opcuaJsonDecodeExtensionObject, opcuaJsonEncodeExtensionObject } from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";

export type Pojo = Record<string, unknown>;

const doDebug = false;

function buildTranslationMap(addressSpace: AddressSpace, sourceNamespaceArray: string[]): Record<number, number> {
    const translationMap: Record<number, number> = {};

    const namespaceArray = addressSpace.getNamespaceArray().map((ns) => ns.namespaceUri);
    for (let index = 0; index < sourceNamespaceArray.length; index++) {
        const translatedIndex = namespaceArray.indexOf(sourceNamespaceArray[index]);
        if (translatedIndex === -1) {
            throw new Error(`cannot find namespace ${sourceNamespaceArray[index]} in ${namespaceArray.join(";")}`);
        }
        translationMap[index] = translatedIndex;
    }
    return translationMap;
}

describe("Testing Encoding/Decoding of custom extension objects ", () => {
    let pojo: ExtensionObjectJSON | Pojo | (ExtensionObjectJSON | Pojo)[];
    let sourceNamespaceArray: string[];
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);

        sourceNamespaceArray = addressSpace.getNamespaceArray().map((ns) => ns.namespaceUri);

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        if (nsAutoId < 0) {
            throw new Error("Cannot find namespace index for http://opcfoundation.org/UA/AutoID/");
        }

        const rfidScanResult = addressSpace.findDataType("RfidScanResult", nsAutoId);
        if (!rfidScanResult) {
            throw new Error("Cannot find ScanResult");
        }

        const scanResult = addressSpace.constructExtensionObject(rfidScanResult, {
            codeType: "Hello",
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(Date.UTC(2018, 11, 23)),
            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(Date.UTC(2018, 11, 23)),
                    dilutionOfPrecision: 0.01,
                    usefulPrecision: 2
                }
            }
        });
        // console.log(scanResult.toString());

        pojo =
            opcuaJsonEncodeExtensionObject(scanResult, JsonEncodingScheme.Verbose) ||
            (() => {
                throw new Error("expecting a valid pojo");
            })();
    });

    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("should construct a custom extension object", async () => {
        pojo.should.eql({
            UaTypeId: "ns=2;i=3007",
            UaBody: {
                CodeType: "Hello",
                ScanData: {
                    SwitchField: 3,
                    Value: { PC: 0, UId: "SGVsbG8=", XPC_W1: 0, XPC_W2: 0 }
                },
                Timestamp: new Date("2018-12-23T00:00:00.000Z"),
                Location: {
                    SwitchField: 2,
                    Value: {
                        X: 100,
                        Y: 200,
                        Z: 300,
                        Timestamp: new Date("2018-12-23T00:00:00.000Z"),
                        DilutionOfPrecision: 0.01,
                        UsefulPrecision: 2
                    }
                },
                Sighting: []
            }
        });
        doDebug && console.log(util.inspect(pojo, { depth: 10 }));
    });

    it("should decode the custom extension Object ", async () => {
        const addressSpace2 = AddressSpace.create();
        await generateAddressSpace(addressSpace2, [
            nodesets.standard,
            nodesets.di,
            nodesets.commercialKitchenEquipment,
            nodesets.autoId
        ]);
        const translationMap = buildTranslationMap(addressSpace2, sourceNamespaceArray);

        const factory = {
            getExtensionObjectConstructor(dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
                dataTypeNodeId.namespace = translationMap[dataTypeNodeId.namespace];
                return addressSpace2.getExtensionObjectConstructor(dataTypeNodeId) as ExtensionObjectConstructorFuncWithSchema;
            }
        };

        const obj = opcuaJsonDecodeExtensionObject(pojo as ExtensionObjectJSON, factory, []);
        if (!obj) throw new Error("expecting a valid extension object");

        (obj.constructor as ExtensionObjectConstructorFuncWithSchema).schema.name.should.eql("RfidScanResult");

        doDebug && console.log(obj.toString());

        interface P {
            UaTypeId: string;
        }
        const pojo2 = opcuaJsonEncodeExtensionObject(
            obj,
            JsonEncodingScheme.Verbose,
            addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
        );
        (pojo2 as P).UaTypeId.should.eql("ns=3;i=3007");

        (pojo2 as P).UaTypeId = "ns=2;i=3007";

        await addressSpace2.shutdown();
        addressSpace2.dispose();

        should(pojo2).eql(pojo);
    });
});
