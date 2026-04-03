/**
 * Default type/value table shared by static, simulation, mass, and large array builders.
 */
import { emptyGuid } from "node-opcua-basic-types";
import * as ec from "node-opcua-basic-types";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId } from "node-opcua-nodeid";

export const typeAndDefaultValue = [
    { type: "Boolean", defaultValue: false },
    { type: "ByteString", defaultValue: Buffer.from("OPCUA") },
    { type: "DateTime", defaultValue: ec.getMinOPCUADate() },
    { type: "Double", defaultValue: 0.0 },
    { type: "Float", defaultValue: 0.0 },
    { type: "Guid", defaultValue: emptyGuid },
    { type: "SByte", defaultValue: 0 },
    { type: "Int16", defaultValue: 0 },
    { type: "Int32", defaultValue: 0 },
    {
        type: "NodeId",
        defaultValue() {
            return coerceNodeId(`ns=${3};g=00000000-0000-0000-0000-000000000023`);
        }
    },
    { type: "String", defaultValue: "OPCUA" },
    { type: "Byte", defaultValue: 0 },
    { type: "UInt16", defaultValue: 0 },
    { type: "UInt32", defaultValue: 0 },
    { type: "Duration", realType: "Double", defaultValue: 0.0 },
    { type: "Number", realType: "UInt16", defaultValue: 0 }, // Number is abstract
    { type: "Integer", realType: "Int64", defaultValue: 0 }, // because Integer is abstract, we choose Int64
    { type: "UInteger", realType: "UInt64", defaultValue: 0 },
    {
        type: "UtcTime",
        realType: "DateTime",
        defaultValue() {
            return new Date();
        }
    },
    { type: "LocaleId", realType: "String", defaultValue: "" },
    {
        type: "LocalizedText",
        defaultValue() {
            return new LocalizedText({});
        }
    },
    {
        type: "QualifiedName",
        defaultValue() {
            return new QualifiedName();
        }
    },
    { type: "UInt64", defaultValue: [0, 0] },
    { type: "Int64", defaultValue: [0, 0] },
    { type: "XmlElement", defaultValue: "<string1>OPCUA</string1>" },
    { type: "ImageBMP", realType: "ByteString", defaultValue: null },
    { type: "ImageGIF", realType: "ByteString", defaultValue: null },
    { type: "ImageJPG", realType: "ByteString", defaultValue: null },
    { type: "ImagePNG", realType: "ByteString", defaultValue: null }
];
