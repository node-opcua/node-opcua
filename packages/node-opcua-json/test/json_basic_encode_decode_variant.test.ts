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

import { AddressSpace, type IAddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { DataTypeIds } from "node-opcua-constants";
import type { ExtensionObject } from "node-opcua-extension-object";
import { coerceNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";

import {
    type ExtensionObjectJSON104,
    type ExtensionObjectJSON105,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeVariant
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

const Reversible = JsonEncodingScheme.DeprecatedReversible;
const NonReversible = JsonEncodingScheme.DeprecatedNonReversible;

/// /
describe("JSON encode Variant", () => {
    describe("Scalars", () => {
        const variantByte = new Variant({ dataType: DataType.Byte, value: 42 });
        const variantByteZero = new Variant({ dataType: DataType.Byte, value: 0 });

        it("Byte - Reversible/NonReversible (104)", () => {
            should(opcuaJsonEncodeVariant(variantByte, NonReversible, namespaceArray)).eql(42);

            should(opcuaJsonEncodeVariant(variantByte, Reversible, namespaceArray)).eql({
                Type: 3,
                Body: 42
            });
        });

        it("Byte - Compact/Verbose (105)", () => {
            should(opcuaJsonEncodeVariant(variantByte, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 3,
                Value: 42
            });
            should(opcuaJsonEncodeVariant(variantByte, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 3,
                Value: 42
            });
        });

        it("Byte - Compact*/Verbose (105)", () => {
            should(opcuaJsonEncodeVariant(variantByteZero, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 3
            });
            should(opcuaJsonEncodeVariant(variantByteZero, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 3,
                Value: 0
            });
        });

        const variantBooleanTrue = new Variant({
            dataType: DataType.Boolean,
            value: true
        });
        const variantBooleanFalse = new Variant({
            dataType: DataType.Boolean,
            value: false
        });
        it("Boolean - Reversible/NonReversible (104)", () => {
            should(opcuaJsonEncodeVariant(variantBooleanTrue, NonReversible, namespaceArray)).eql(true);

            should(opcuaJsonEncodeVariant(variantBooleanTrue, Reversible, namespaceArray)).eql({
                Type: 1,
                Body: true
            });
        });
        it("Boolean - Compact/Verbose (105)", () => {
            should(opcuaJsonEncodeVariant(variantBooleanTrue, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 1,
                Value: true
            });

            should(opcuaJsonEncodeVariant(variantBooleanTrue, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 1,
                Value: true
            });
            should(opcuaJsonEncodeVariant(variantBooleanFalse, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 1
                // Value: false, // Compact encoding does not include Value for false as it is the default value
            });

            should(opcuaJsonEncodeVariant(variantBooleanFalse, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 1,
                Value: false
            });
        });

        const variantString = new Variant({
            dataType: DataType.String,
            value: "Hello World"
        });
        const variantStringEmpty = new Variant({
            dataType: DataType.String,
            value: ""
        });
        it("String - Reversible/NonReversible (104)", () => {
            should(opcuaJsonEncodeVariant(variantString, NonReversible, namespaceArray)).eql("Hello World");

            should(opcuaJsonEncodeVariant(variantString, Reversible, namespaceArray)).eql({
                Type: 12,
                Body: "Hello World"
            });
        });
        it("String - Compact/Verbose (105)", () => {
            should(opcuaJsonEncodeVariant(variantString, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 12,
                Value: "Hello World"
            });

            should(opcuaJsonEncodeVariant(variantString, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 12,
                Value: "Hello World"
            });
            should(opcuaJsonEncodeVariant(variantStringEmpty, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 12
                // Value: "Hello World",
            });

            should(opcuaJsonEncodeVariant(variantStringEmpty, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: 12,
                Value: ""
            });
        });

        const variantGuid = new Variant({
            dataType: DataType.Guid,
            value: "41a54988-ceab-4151-84ae-32cc61bd41cc"
        });
        const variantGuidDefault = new Variant({
            dataType: DataType.Guid,
            value: "00000000-0000-0000-0000-000000000000"
        });
        it("Guid - Reversible/NonReversible (104)", () => {
            should(opcuaJsonEncodeVariant(variantGuid, NonReversible, namespaceArray)).eql("41a54988-ceab-4151-84ae-32cc61bd41cc");

            should(opcuaJsonEncodeVariant(variantGuid, Reversible, namespaceArray)).eql({
                Type: 14,
                Body: "41a54988-ceab-4151-84ae-32cc61bd41cc"
            });
        });
        it("Guid - Compact/Verbose (105)", () => {
            const compact = opcuaJsonEncodeVariant(variantGuid, JsonEncodingScheme.Compact, namespaceArray);
            should(compact).eql({
                UaType: 14,
                Value: "41a54988-ceab-4151-84ae-32cc61bd41cc"
            });

            const verbose = opcuaJsonEncodeVariant(variantGuid, JsonEncodingScheme.Verbose, namespaceArray);
            should(verbose).eql({
                UaType: 14,
                Value: "41a54988-ceab-4151-84ae-32cc61bd41cc"
            });
        });
        it("Guid - Compact/Verbose (105) - default value", () => {
            // The CompactEncoding omits all fields with a value equal to the default value for the type
            // The VerboseEncoding includes all fields.

            const compact = opcuaJsonEncodeVariant(variantGuidDefault, JsonEncodingScheme.Compact, namespaceArray);
            should(compact).eql({
                UaType: 14
                // Value: "00000000-0000-0000-0000-000000000000",
            });

            const verbose = opcuaJsonEncodeVariant(variantGuidDefault, JsonEncodingScheme.Verbose, namespaceArray);
            should(verbose).eql({
                UaType: 14,
                Value: "00000000-0000-0000-0000-000000000000"
            });
        });

        const variantByteString = new Variant({
            dataType: DataType.ByteString,
            value: Buffer.from("41a54988ceab415184ae32cc61bd41cc", "hex")
        });
        it("ByteString - Reversible/NonReversible (104)", () => {
            should(opcuaJsonEncodeVariant(variantByteString, NonReversible, namespaceArray)).eql("QaVJiM6rQVGErjLMYb1BzA==");

            should(opcuaJsonEncodeVariant(variantByteString, Reversible, namespaceArray)).eql({
                Type: 15,
                Body: "QaVJiM6rQVGErjLMYb1BzA=="
            });
        });
        it("ByteString - Compact/Verbose (105)", () => {
            const compact = opcuaJsonEncodeVariant(variantByteString, JsonEncodingScheme.Compact, namespaceArray);
            should(compact).eql({
                UaType: 15,
                Value: "QaVJiM6rQVGErjLMYb1BzA=="
            });

            const verbose = opcuaJsonEncodeVariant(variantByteString, JsonEncodingScheme.Verbose, namespaceArray);
            should(verbose).eql({
                UaType: 15,
                Value: "QaVJiM6rQVGErjLMYb1BzA=="
            });
        });

        const variantDate = new Variant({
            dataType: DataType.DateTime,
            value: new Date("1789-07-14T12:01:49.000Z")
        });

        it("DateTime - Reversible/NonReversible (104)", () => {
            const dateCheck = new Date("1789-07-14T12:01:49.000Z");

            should(opcuaJsonEncodeVariant(variantDate, NonReversible, namespaceArray)).eql(dateCheck);

            JSON.stringify(opcuaJsonEncodeVariant(variantDate, NonReversible, namespaceArray)).should.eql(
                '"1789-07-14T12:01:49.000Z"'
            );

            should(opcuaJsonEncodeVariant(variantDate, Reversible, namespaceArray)).eql({
                Type: 13,
                Body: dateCheck
            });
        });
        it("DateTime - Compact/Verbose (105)", () => {
            const dateCheck = new Date("1789-07-14T12:01:49.000Z");

            const compact = opcuaJsonEncodeVariant(variantDate, JsonEncodingScheme.Compact, namespaceArray);
            should(compact).eql({
                UaType: 13,
                Value: dateCheck
            });

            const verbose = opcuaJsonEncodeVariant(variantDate, JsonEncodingScheme.Verbose, namespaceArray);
            should(verbose).eql({
                UaType: 13,
                Value: dateCheck
            });
        });
    });

    const namespaceArray = ["http://opcfoundation.org/UA/", "http://n1;", "http://n2", "http://n3"];
    const variantNodeId = new Variant({
        dataType: DataType.NodeId,
        value: coerceNodeId("ns=1;i=1234")
    });
    it("NodeId - Reversible (104)", () => {
        const reversible = opcuaJsonEncodeVariant(variantNodeId, Reversible, namespaceArray);
        should(reversible).eql({
            Type: 17,
            Body: { Id: 1234, Namespace: 1 }
        });
    });
    it("NodeId - NonReversible (104)", () => {
        const nonReversible = opcuaJsonEncodeVariant(variantNodeId, NonReversible, namespaceArray);
        should(nonReversible).eql({ Id: 1234, Namespace: 1 });
    });
    it("NodeId - Compact (105)", () => {
        const compact = opcuaJsonEncodeVariant(variantNodeId, JsonEncodingScheme.Compact, namespaceArray);
        should(compact).eql({ UaType: 17, Value: "nsu=http://n1%3B;i=1234" });
    });
    it("NodeId - Verbose (105)", () => {
        const verbose = opcuaJsonEncodeVariant(variantNodeId, JsonEncodingScheme.Verbose, namespaceArray);
        should(verbose).eql({ UaType: 17, Value: "nsu=http://n1%3B;i=1234" });
    });

    describe("Arrays", () => {
        const variantArrayOfFloat = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [3.140000104904175, 6.28000020980835, 42]
        });
        it("should encode a Variant Array of Float (104)", () => {
            should(opcuaJsonEncodeVariant(variantArrayOfFloat, NonReversible, namespaceArray)).eql([
                3.140000104904175, 6.28000020980835, 42
            ]);

            JSON.stringify(opcuaJsonEncodeVariant(variantArrayOfFloat, NonReversible, namespaceArray)).should.eql(
                "[3.140000104904175,6.28000020980835,42]"
            );

            should(opcuaJsonEncodeVariant(variantArrayOfFloat, Reversible, namespaceArray)).eql({
                Type: DataType.Float,
                Body: [3.140000104904175, 6.28000020980835, 42]
            });
        });
        it("should encode a Variant Array of Float (105)", () => {
            should(opcuaJsonEncodeVariant(variantArrayOfFloat, NonReversible, namespaceArray)).eql([
                3.140000104904175, 6.28000020980835, 42
            ]);

            JSON.stringify(opcuaJsonEncodeVariant(variantArrayOfFloat, JsonEncodingScheme.Compact, namespaceArray)).should.eql(
                '{"UaType":10,"Value":[3.140000104904175,6.28000020980835,42]}'
            );

            should(opcuaJsonEncodeVariant(variantArrayOfFloat, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: DataType.Float,
                Value: [3.140000104904175, 6.28000020980835, 42]
            });
        });
    });
    describe("Matrix", () => {
        const variantMatrixOfFloat = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Matrix,
            value: [
                //
                3.140000104904175, 6.28000020980835, 42,
                //
                1, 2, 3
            ],
            dimensions: [2, 3]
        });
        it("should encode a Variant Array of Float (104)", () => {
            should(opcuaJsonEncodeVariant(variantMatrixOfFloat, NonReversible, namespaceArray)).eql({
                Type: 10,
                Dimensions: [2, 3],
                Body: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3]
            });
            JSON.stringify(opcuaJsonEncodeVariant(variantMatrixOfFloat, NonReversible, namespaceArray)).should.eql(
                '{"Type":10,"Body":[3.140000104904175,6.28000020980835,42,1,2,3],"Dimensions":[2,3]}'
            );

            should(opcuaJsonEncodeVariant(variantMatrixOfFloat, Reversible, namespaceArray)).eql({
                Type: DataType.Float,
                Body: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3],
                Dimensions: [2, 3]
            });
        });
        it("should encode a Variant Array of Float (105)", () => {
            should(opcuaJsonEncodeVariant(variantMatrixOfFloat, JsonEncodingScheme.Compact, namespaceArray)).eql({
                UaType: 10,
                UaDimensions: [2, 3],
                Value: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3]
            });

            JSON.stringify(opcuaJsonEncodeVariant(variantMatrixOfFloat, JsonEncodingScheme.Compact, namespaceArray)).should.eql(
                '{"UaType":10,"Value":[3.140000104904175,6.28000020980835,42,1,2,3],"UaDimensions":[2,3]}'
            );

            should(opcuaJsonEncodeVariant(variantMatrixOfFloat, JsonEncodingScheme.Verbose, namespaceArray)).eql({
                UaType: DataType.Float,
                Value: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3],
                UaDimensions: [2, 3]
            });
        });
    });
});
describe("JSON decode Variant", () => {
    const namespaceArray = ["http://opcfoundation.org/UA/", "n1;", "n2", "n3"];

    describe("Scalar", () => {
        it("should decode a null variant", () => {
            opcuaJsonDecodeVariant(null, fakeBuilder, namespaceArray).should.eql(new Variant({ dataType: DataType.Null }));
        });
        it("should decode a DateTime JSON variant", () => {
            const variantDate = new Variant({
                dataType: DataType.DateTime,
                value: new Date("1789-07-14T12:01:49.000Z")
            });
            opcuaJsonDecodeVariant(
                JSON.parse('{"Type": 13, "Body":"1789-07-14T12:01:49.000Z"}'),
                fakeBuilder,
                namespaceArray
            ).should.eql(variantDate);
        });
        it("should decode a  ByteString JSON variant", () => {
            const value = Buffer.from("41a54988ceab415184ae32cc61bd41cc", "hex");
            const variantByteString = new Variant({
                dataType: DataType.ByteString,
                value
            });
            opcuaJsonDecodeVariant(
                JSON.parse('{"Type": 15, "Body":"QaVJiM6rQVGErjLMYb1BzA=="}'),
                fakeBuilder,
                namespaceArray
            ).should.eql(variantByteString);
        });
        it("should decode a Int64 JSON variant", () => {
            const variantInt64 = new Variant({
                dataType: DataType.Int64,
                arrayType: VariantArrayType.Scalar,
                value: [0, 376896]
            });
            opcuaJsonDecodeVariant(JSON.parse('{"Type": 8, "Body":"376896"}'), fakeBuilder, namespaceArray).should.eql(
                variantInt64
            );
        });
        it("should decode a UInt64 JSON variant", () => {
            const variantUInt64 = new Variant({
                dataType: DataType.UInt64,
                arrayType: VariantArrayType.Scalar,
                value: [0, 376896]
            });
            opcuaJsonDecodeVariant(JSON.parse('{"Type": 9, "Body":"376896"}'), fakeBuilder, namespaceArray).should.eql(
                variantUInt64
            );
        });
    });
    describe("Array", () => {
        it("should decode a Variant Array of Float", () => {
            opcuaJsonDecodeVariant(
                {
                    Type: DataType.Float,
                    Body: [3.140000104904175, 6.28000020980835, 42]
                },
                fakeBuilder,
                namespaceArray
            ).should.eql(
                new Variant({
                    dataType: DataType.Float,
                    arrayType: VariantArrayType.Array,
                    value: [3.140000104904175, 6.28000020980835, 42]
                })
            );
        });
    });
    describe("Matrix", () => {
        it("should decode a Variant Matrix of Float", () => {
            opcuaJsonDecodeVariant(
                {
                    Type: DataType.Float,
                    Body: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3],
                    Dimensions: [2, 3]
                },
                fakeBuilder,
                namespaceArray
            ).should.eql(
                new Variant({
                    dataType: DataType.Float,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [2, 3],
                    value: [3.140000104904175, 6.28000020980835, 42, 1, 2, 3]
                })
            );
        });
    });
});

describe("JSON encode/decode Variant", () => {
    it("should encode and decode a Variant Byte", () => {
        const _pojo: ExtensionObjectJSON105 = {
            UaTypeId: "ns=1;i=1234",
            UaBody: {
                Field1: 42,
                Field2: "42"
            }
        };
    });
    it("should encode and decode a Variant Byte", () => {
        const _pojo: ExtensionObjectJSON104 = {
            TypeId: "ns=1;i=1234",
            Body: {
                Field1: 42,
                Field2: "42"
            }
        };
    });
});

describe("JSON encode/decode Variant with ExtensionObject", () => {
    let addressSpace: IAddressSpace;
    let obj: ExtensionObject;
    let variant: Variant;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const n = addressSpace.findNode(DataTypeIds.ServerStatusDataType);
        if (!n) {
            throw new Error("Cannot find ServerState DataType");
        }
        n.nodeId.should.eql(coerceNodeId("ns=0;i=862"));
        obj = addressSpace.constructExtensionObject(n.nodeId, {
            state: "Running",
            startTime: new Date("2020-01-01T00:00:00Z"),
            currentTime: new Date("2020-01-01T01:00:00Z"),
            buildInfo: {
                productUri: "http://example.com/product",
                manufacturerName: "Example Manufacturer",
                productName: "Example Product",
                softwareVersion: "1.0.0",
                buildNumber: "12345",
                buildDate: new Date("2020-01-01T00:00:00Z")
            }
        });
        // console.log("obj = ", obj.toString());
        variant = new Variant({
            dataType: DataType.ExtensionObject,
            value: obj
        });
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });
    it("Server State - Compact", () => {
        const compact = opcuaJsonEncodeVariant(variant, JsonEncodingScheme.Compact, []);
        should(compact).eql({
            UaType: 22,
            Value: {
                UaTypeId: "i=862",
                UaBody: {
                    StartTime: new Date("2020-01-01 01:00:00.000 +0100"),
                    CurrentTime: new Date("2020-01-01 02:00:00.000 +0100"),
                    State: 0,
                    BuildInfo: {
                        ProductUri: "http://example.com/product",
                        ManufacturerName: "Example Manufacturer",
                        ProductName: "Example Product",
                        SoftwareVersion: "1.0.0",
                        BuildNumber: "12345",
                        BuildDate: new Date("2020-01-01 01:00:00.000 +0100")
                    },
                    SecondsTillShutdown: 0
                }
            }
        });
    });
    it("Server State - Verbose", () => {
        const compact = opcuaJsonEncodeVariant(variant, JsonEncodingScheme.Verbose, []);
        should(compact).eql({
            UaType: 22,
            Value: {
                UaTypeId: "i=862",
                UaBody: {
                    BuildInfo: {
                        BuildDate: new Date("2020-01-01T00:00:00.000Z"),
                        BuildNumber: "12345",
                        ManufacturerName: "Example Manufacturer",
                        ProductName: "Example Product",
                        ProductUri: "http://example.com/product",
                        SoftwareVersion: "1.0.0"
                    },
                    CurrentTime: new Date("2020-01-01T01:00:00.000Z"),
                    SecondsTillShutdown: 0,
                    ShutdownReason: null,
                    StartTime: new Date("2020-01-01T00:00:00.000Z"),
                    State: 0
                }
            }
        });
    });
    it("Server State - Reversible", () => {
        const compact = opcuaJsonEncodeVariant(variant, JsonEncodingScheme.DeprecatedReversible, []);
        should(compact).eql({
            Type: 22,
            Body: {
                TypeId: { Id: 862 },
                Body: {
                    BuildInfo: {
                        BuildDate: new Date("2020-01-01T00:00:00.000Z"),
                        BuildNumber: "12345",
                        ManufacturerName: "Example Manufacturer",
                        ProductName: "Example Product",
                        ProductUri: "http://example.com/product",
                        SoftwareVersion: "1.0.0"
                    },
                    CurrentTime: new Date("2020-01-01T01:00:00.000Z"),
                    SecondsTillShutdown: 0,
                    ShutdownReason: null,
                    StartTime: new Date("2020-01-01T00:00:00.000Z"),
                    State: 0
                }
            }
        });
    });
    it("Server State - NonRevesible", () => {
        const compact = opcuaJsonEncodeVariant(variant, JsonEncodingScheme.DeprecatedNonReversible, []);
        should(compact).eql({
            BuildInfo: {
                BuildDate: new Date("2020-01-01T00:00:00.000Z"),
                BuildNumber: "12345",
                ManufacturerName: "Example Manufacturer",
                ProductName: "Example Product",
                ProductUri: "http://example.com/product",
                SoftwareVersion: "1.0.0"
            },
            CurrentTime: new Date("2020-01-01T01:00:00.000Z"),
            SecondsTillShutdown: 0,
            ShutdownReason: null,
            StartTime: new Date("2020-01-01T00:00:00.000Z"),
            State: 0
        });
    });
});
