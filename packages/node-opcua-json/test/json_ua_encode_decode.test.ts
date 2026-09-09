import type { ExtensionObjectConstructorFuncWithSchema } from "node-opcua-address-space";
import { AttributeIds, DataType } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { ReadValueId, WriteValue } from "node-opcua-types";
import should from "should";

import {
    type ExtensionObjectBuilder,
    type ExtensionObjectJSON,
    JsonEncodingScheme,
    opcuaJsonDecodeExtensionObject,
    opcuaJsonEncodeExtensionObject
} from "../source/index.js";

describe("JSON UA encode/decode", () => {
    const numericRange = new NumericRange(1, 2);

    const writeValue = new WriteValue({
        nodeId: "ns=1;s=TestNode",
        attributeId: AttributeIds.Value,
        value: {
            value: {
                dataType: DataType.Double,
                value: 42.0 // Example value to write
            }
        }
    });
    const readValue = new ReadValueId({
        nodeId: "ns=1;s=TestNode",
        attributeId: AttributeIds.Value
    });
    const readValueWithNumericRange = new ReadValueId({
        nodeId: "ns=1;s=TestNode",
        attributeId: AttributeIds.Value,
        indexRange: numericRange
    });
    const builder: ExtensionObjectBuilder = {
        getExtensionObjectConstructor(_dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
            // This is a mock implementation, replace with actual logic to get the constructor
            return null as unknown as ExtensionObjectConstructorFuncWithSchema;
        }
    };
    [writeValue, readValue, readValueWithNumericRange].forEach((value) => {
        it(`should encode and decode ${value.constructor.name} - Compact`, () => {
            const json = opcuaJsonEncodeExtensionObject(value, JsonEncodingScheme.Compact, []);
            const decodedValue = opcuaJsonDecodeExtensionObject(json as ExtensionObjectJSON, builder, []);
            // console.log("Encoded JSON:", JSON.stringify(json, null, 2));
            should(decodedValue?.toString()).equal(
                value.toString(),
                `Decoded value should match original for ${value.constructor.name}`
            );
        });
        it(`should encode and decode ${value.constructor.name} - Verbose`, () => {
            const json = opcuaJsonEncodeExtensionObject(value, JsonEncodingScheme.Verbose, []);
            const decodedValue = opcuaJsonDecodeExtensionObject(json as ExtensionObjectJSON, builder, []);
            // console.log("Encoded JSON:", JSON.stringify(json, null, 2));
            should(decodedValue?.toString()).equal(
                value.toString(),
                `Decoded value should match original for ${value.constructor.name}`
            );
        });
    });
});
