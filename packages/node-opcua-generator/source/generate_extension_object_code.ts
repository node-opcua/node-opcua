/* eslint-disable max-statements */
/* istanbul ignore file */
/**
 * @module node-opcua-generator
 */
// tslint:disable:max-line-length
// tslint:disable:no-inner-declarations
//
import * as fs from "fs";
import * as chalk from "chalk";
// node 14 onward : import { readFile } from "fs/promises";
const { readFile } = fs.promises;

// import * as prettier from "prettier";

import { assert } from "node-opcua-assert";
import { DataTypeIds, ObjectIds } from "node-opcua-constants";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import {
    EnumerationDefinitionSchema,
    FieldCategory,
    getStandardDataTypeFactory,
    StructuredTypeSchema,
    DataTypeFactory,
    IStructuredTypeSchema
} from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { DataTypeAndEncodingId, MapDataTypeAndEncodingIdProvider, parseBinaryXSDAsync } from "node-opcua-schemas";

import { writeStructuredType } from "./factory_code_generator";
import { LineFile1 } from "./utils/line_file";
import { makeWrite } from "./utils/write_func";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

const f = new LineFile1();

const write = makeWrite(f);

// eslint-disable-next-line max-statements
function writeEnumeratedType(enumerationSchema: EnumerationDefinitionSchema): void {
    const arrayValues = Object.keys(enumerationSchema.enumValues)
        .filter((a: string) => a.match("[0-9]+"))
        .map((a: string) => parseInt(a, 10))
        .filter((a: number) => a !== 0xffffffff)
        .sort((a: number, b: number) => a - b);

    // determining if enum is of type FLAGS
    const isFlaggable = arrayValues.length > 2 && arrayValues[2] === arrayValues[1] * 2 && arrayValues[3] === arrayValues[2] * 2;
    // find min and max values (excluding
    const minEnumValue = Math.min.apply(null, arrayValues);
    const maxEnumValue = Math.max.apply(null, arrayValues);

    // make sure there is a Invalid key in the enum => else insert one (but only if not flaggable)
    const hasInvalid = Object.prototype.hasOwnProperty.call(enumerationSchema.enumValues, "Invalid");
    if (!hasInvalid && !isFlaggable) {
        enumerationSchema.enumValues[(enumerationSchema.enumValues.Invalid = 0xffffffff)] = "Invalid";
    }

    write("");
    write(`// --------------------------------------------------------------------------------------------`);
    write(`export enum ${enumerationSchema.name} {`);

    const str = [];

    const values = Object.keys(enumerationSchema.enumValues).filter((a: any) => a.match(/^[0-9]+$/));

    for (const value of values) {
        str.push(`    ${enumerationSchema.enumValues[value]} = ${value}`);
    }
    write(str.join(",\n"));
    write(`}`);

    write(`const schema${enumerationSchema.name} = {`);
    // xx write(`    documentation: "${enumerationSchema.documentation}",`);
    write(`    enumValues: ${enumerationSchema.name},`);
    write(`    flaggable: ${isFlaggable},`);
    if (!isFlaggable) {
        write(`    minValue: ${minEnumValue},`);
        write(`    maxValue: ${maxEnumValue},`);
    }
    write(`    name: "${enumerationSchema.name}"`);

    write(`};`);
    write(
        `function decode${enumerationSchema.name}(stream: BinaryStream, _value?: ${enumerationSchema.name}): ${enumerationSchema.name} {`
    );
    if (!isFlaggable) {
        if (enumerationSchema.lengthInBits === 16) {
            write(`    let value =  stream.readUInt16() as ${enumerationSchema.name};`);
        } else {
            assert(enumerationSchema.lengthInBits === 32);
            write(`    let value =  stream.readUInt32() as ${enumerationSchema.name};`);
        }
        write(
            `    value = (value < schema${enumerationSchema.name}.minValue || value > schema${enumerationSchema.name}.maxValue) ? ${enumerationSchema.name}.Invalid : value; `
        );
        write(`    return value;`);
    } else {
        write(`    return  stream.readUInt32() as ${enumerationSchema.name};`);
    }
    write(`}`);
    write(`function encode${enumerationSchema.name}(value: ${enumerationSchema.name}, stream: OutputBinaryStream): void {`);
    if (enumerationSchema.lengthInBits === 16) {
        write(`    stream.writeUInt16(value);`);
    } else {
        assert(enumerationSchema.lengthInBits === 32);
        write(`    stream.writeUInt32(value);`);
    }
    write(`}`);

    write(`export const _enumeration${enumerationSchema.name} = registerEnumeration(schema${enumerationSchema.name});`);
    write(`assert(_enumeration${enumerationSchema.name}.isFlaggable ===  ${isFlaggable});`);
}

function writeStructuredTypeWithSchema(structuredType: IStructuredTypeSchema) {
    write(`// --------------------------------------------------------------------------------------------`);

    write(`const schema${structuredType.name} = buildStructuredType({`);
    write(`    name: "${structuredType.name}",`);
    write(``);
    write(`    baseType: "${structuredType.baseType}",`);
    write(`    fields: [`);
    for (const field of structuredType.fields) {
        write(`        {`);
        write(`            name: "${field.name}",`);
        write(``);
        write(`            fieldType: "${field.fieldType}",`);
        if (field.isArray) {
            write(`            isArray: ${field.isArray}`);
        }
        // write(`            /* cat = ${field.category} */`);
        write(`        },`);
    }
    write(`    ]`);
    write(`});`);

    writeStructuredType(write, structuredType);
}

export async function generate(filename: string, generatedTypescriptFilename: string): Promise<void> {
    const content = await readFile(filename, "utf-8");

    const idProvider: MapDataTypeAndEncodingIdProvider = {
        getDataTypeAndEncodingId(name: string): DataTypeAndEncodingId | null {
            const dataType = (DataTypeIds as any)[name] || 0;
            const binEncoding = (ObjectIds as any)[name + "_Encoding_DefaultBinary"] || 0;
            const xmlEncoding = (ObjectIds as any)[name + "_Encoding_DefaultXml"] || 0;
            const jsonEncoding = (ObjectIds as any)[name + "_Encoding_DefaultJson"] || 0;
            if (dataType === undefined) {
                return null;
            }
            const dataTypeNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, dataType, 0);
            const binaryEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, binEncoding, 0);
            const xmlEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, xmlEncoding, 0);
            const jsonEncodingNodeId = new NodeId(NodeId.NodeIdType.NUMERIC, jsonEncoding, 0);
            const data: DataTypeAndEncodingId = {
                binaryEncodingNodeId,
                dataTypeNodeId,
                jsonEncodingNodeId,
                xmlEncodingNodeId
            };
            if (doDebug) {
                debugLog(
                    " data=",
                    chalk.cyan(name.padEnd(43, " ")),
                    data.dataTypeNodeId.toString().padEnd(43, " "),
                    data.binaryEncodingNodeId.toString().padEnd(43, " ")
                );
            }
            return data;
        }
    };

    const dataTypeFactory = new DataTypeFactory([getStandardDataTypeFactory()]);
    await parseBinaryXSDAsync(content, idProvider, dataTypeFactory);

    write(
        `// tslint:disable:no-this-assignment
// tslint:disable:max-classes-per-file
// tslint:disable:no-empty-interface
// tslint:disable:no-trailing-whitespace
// tslint:disable:array-type
// tslint:disable:object-literal-sort-keys
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";
import {
    Byte, ByteString, CharArray, DateTime,
    decodeArray, decodeBoolean, decodeByte, decodeByteString,
    decodeDateTime, decodeDouble, decodeExpandedNodeId, decodeFloat,
    decodeGuid, decodeInt16,
    decodeInt32, decodeInt64,
    decodeInt8, decodeNodeId,
    decodeString, decodeUABoolean,
    decodeUAString, decodeUInt16,
    decodeUInt32, decodeUInt64,
    decodeUInt8,
    decodeSByte,
    Double,
    encodeArray, encodeBoolean,
    encodeSByte, encodeByte, encodeByteString,
    encodeDateTime, encodeDouble,
    encodeExpandedNodeId, encodeFloat,
    encodeGuid, encodeInt16,
    encodeInt32, encodeInt64,
    encodeInt8, encodeNodeId,
    encodeString, encodeUABoolean,
    encodeUAString, encodeUInt16,
    encodeUInt32, encodeUInt64, encodeUInt8,
    Float, Guid,
    Int16, Int32,
    Int64,
    Int8,
    SByte,
    UABoolean,
    UAString, UInt16, UInt32,
    UInt64, UInt8,
} from "node-opcua-basic-types";

import { Enum, EnumItem } from "node-opcua-enum";

import { BinaryStream , OutputBinaryStream} from "node-opcua-binary-stream";
import {
    _enumerationBrowseDirection, BrowseDirection, decodeBrowseDirection, decodeDiagnosticInfo,
    decodeLocalizedText, decodeQualifiedName,
    DiagnosticInfo, DiagnosticInfoOptions,
    encodeBrowseDirection,
    encodeDiagnosticInfo, encodeLocalizedText, encodeQualifiedName,
    LocalizedText, LocalizedTextLike, QualifiedName, QualifiedNameLike,
    LocalizedTextOptions,    QualifiedNameOptions,
} from "node-opcua-data-model";
import {
    _enumerationTimestampsToReturn, DataValue, DataValueLike, DataValueOptions, decodeDataValue,
    decodeTimestampsToReturn, encodeDataValue, encodeTimestampsToReturn, TimestampsToReturn
} from "node-opcua-data-value";
import {
    decodeExtensionObject, encodeExtensionObject, ExtensionObject
} from "node-opcua-extension-object";
import {
    BaseUAObject, buildStructuredType, check_options_correctness_against_schema,
    initialize_field, initialize_field_array, parameters,
    registerClassDefinition,
    registerEnumeration, StructuredTypeSchema
} from "node-opcua-factory";
import {
    ExpandedNodeId, makeExpandedNodeId, NodeId, NodeIdLike
} from "node-opcua-nodeid";
import {
    decodeNumericRange, encodeNumericRange, NumericRange
} from "node-opcua-numeric-range";
import {
    decodeStatusCode, encodeStatusCode, StatusCode, StatusCodes
} from "node-opcua-status-code";
import {
    decodeVariant, encodeVariant, Variant, VariantLike,
    VariantOptions
} from "node-opcua-variant";`
    );

    write(``);

    // write(`export class DataTypeDefinition extends BaseUAObject {`);
    // write(`    constructor(options: any) {`);
    // write(`        options = options; // do not remove`);
    // write(`        super();`);
    // write(`    }`);
    // write(`}`);
    // write(``);

    const alreadyDone: { [key: string]: any } = {};
    /* tslint:disable:no-string-literal */
    alreadyDone["ExtensionObject"] = true;
    alreadyDone["NodeId"] = true;

    alreadyDone["ExpandedNodeId"] = true;
    alreadyDone["Variant"] = true;
    alreadyDone["XmlElement"] = true;

    alreadyDone["NodeIdType"] = true;
    alreadyDone["TwoByteNodeId"] = true;
    alreadyDone["FourByteNodeId"] = true;
    alreadyDone["NumericNodeId"] = true;
    alreadyDone["StringNodeId"] = true;
    alreadyDone["GuidNodeId"] = true;
    alreadyDone["ByteStringNodeId"] = true;

    alreadyDone["DiagnosticInfo"] = true;
    alreadyDone["Variant"] = true;
    alreadyDone["DataValue"] = true;
    alreadyDone["LocalizedText"] = true;
    alreadyDone["QualifiedName"] = true;
    alreadyDone["BrowseDirection"] = true;
    alreadyDone["TimestampsToReturn"] = true;

    function processEnumeratedType(enumerationSchema: EnumerationDefinitionSchema): void {
        if (alreadyDone[enumerationSchema.name]) {
            return;
        }
        alreadyDone[enumerationSchema.name] = enumerationSchema;
        writeEnumeratedType(enumerationSchema);
    }

    function processStructuredType(structuredType: IStructuredTypeSchema): void {
        if (alreadyDone[structuredType.name]) {
            return;
        }
        alreadyDone[structuredType.name] = structuredType;

        // make sure
        if (dataTypeFactory.hasStructuredType(structuredType.baseType)) {
            processStructuredType(dataTypeFactory.getStructuredTypeSchema(structuredType.baseType));
        }
        for (const field of structuredType.fields) {
            if (field.category === FieldCategory.complex) {
                const fieldSchema = dataTypeFactory.getStructuredTypeSchema(field.fieldType);
                processStructuredType(fieldSchema);
            }
            if (field.category === FieldCategory.enumeration) {
                const fieldSchema = dataTypeFactory.getEnumeration(field.fieldType)!;
                processEnumeratedType(fieldSchema);
            }
        }
        writeStructuredTypeWithSchema(structuredType);
    }

    //xx processStructuredType(dataTypeFactory.getStructuredTypeSchema("LocalizedText"));
    processStructuredType(dataTypeFactory.getStructuredTypeSchema("AxisInformation"));
    //        processStructuredType(dataTypeFactory.getStructuredTypeSchema("DiagnosticInfo"));
    processStructuredType(dataTypeFactory.getStructuredTypeSchema("SimpleAttributeOperand"));

    for (const structureType of [...dataTypeFactory.structuredTypesNames()].sort()) {
        if (!dataTypeFactory.hasStructuredType(structureType)) {
            continue;
        }
        processStructuredType(dataTypeFactory.getStructuredTypeSchema(structureType));
        // if (++i > 250) { break; }
    }

    write(``);
    f.saveFormat(generatedTypescriptFilename, (code) => {
        return code;
        /*
            const options: prettier.Options = {
                bracketSpacing: true,
                insertPragma: true,
                parser: "typescript",
                printWidth: 120
            };
            return prettier.format(code, options).replace("\n", os.EOL);
            */
    });
}
