/* istanbul ignore file */
/**
 * @module node-opcua-generator
 */
// tslint:disable:max-line-length
// tslint:disable:no-inner-declarations
//
import * as fs from "fs";
import { assert } from "node-opcua-assert";
import {
    EnumerationDefinitionSchema,
    FieldCategory,
    StructuredTypeSchema,
    getStandartDataTypeFactory
} from "node-opcua-factory";
import { EnumeratedType, parseBinaryXSD, TypeDictionary } from "node-opcua-schemas";
import { LineFile } from "node-opcua-utils";
import { promisify } from "util";
import { writeStructuredType } from "./factory_code_generator";
// Xx import * as  prettier from "prettier";

const readFile = promisify(fs.readFile);
const parseBinaryXSD2 = promisify(parseBinaryXSD);

const f = new LineFile();

function write(...args: string[]) {
    f.write.apply(f, args);
}

function writeEnumeratedType(enumerationSchema: EnumerationDefinitionSchema) {

    // make sure there is a Invalid key in the enum => else insert one
    const hasInvalid = enumerationSchema.enumValues.hasOwnProperty("Invalid");
    if (!hasInvalid) {
        // xx console.log("Adding Invalid Enum entry on ", enumeratedType.name);
        enumerationSchema.enumValues[enumerationSchema.enumValues.Invalid = 0xFFFFFFFF] = "Invalid";
    }

    const arrayValues = Object.keys(enumerationSchema.enumValues)
        .filter((a: string) => a.match("[0-9]+"))
        .map((a: string) => parseInt(a, 10))
        .filter((a: number) => a !== 0xFFFFFFFF)
        .sort((a: number, b: number) => a - b);

    // determining if enum is of type FLAGS
    const isFlaggable = arrayValues.length > 2
        && arrayValues[2] === arrayValues[1] * 2
        && arrayValues[3] === arrayValues[2] * 2
    ;
    // find min and max values (excluding
    const minEnumValue = Math.min.apply(null, arrayValues);
    const maxEnumValue = Math.max.apply(null, arrayValues);

    write("");

    write(`// --------------------------------------------------------------------------------------------`);
    write(`export enum ${enumerationSchema.name} {`);

    const str = [];

    const values = Object.keys(enumerationSchema.enumValues).filter((a: any) => a.match("[0-9]+"));

    for (const value of values) {
        str.push(`    ${enumerationSchema.enumValues[value]} = ${value}`);
    }
    write(str.join(",\n"));
    write(`}`);

    write(`const schema${enumerationSchema.name} = {`);
    //xx write(`    documentation: "${enumerationSchema.documentation}",`);
    write(`    enumValues: ${enumerationSchema.name},`);
    write(`    flaggable: ${isFlaggable},`);
    if (!isFlaggable) {
        write(`    minValue: ${minEnumValue},`);
        write(`    maxValue: ${maxEnumValue},`);
    }
    write(`    name: "${enumerationSchema.name}"`);

    write(`};`);
    write(`function decode${enumerationSchema.name}(stream: BinaryStream): ${enumerationSchema.name} {`);
    if (!isFlaggable) {
        write(`    let value =  stream.readUInt32() as ${enumerationSchema.name};`);
        write(`    value = (value < schema${enumerationSchema.name}.minValue || value > schema${enumerationSchema.name}.maxValue) ? ${enumerationSchema.name}.Invalid : value; `);
        write(`    return value;`);
    } else {
        write(`    return  stream.readUInt32() as ${enumerationSchema.name};`);
    }
    write(`}`);
    write(`function encode${enumerationSchema.name}(value: ${enumerationSchema.name}, stream: OutputBinaryStream): void {`);
    write(`    stream.writeUInt32(value);`);
    write(`}`);

    write(`export const _enumeration${enumerationSchema.name} = registerEnumeration(schema${enumerationSchema.name});`);

}

function writeStructuredTypeWithSchema(structuredType: StructuredTypeSchema) {

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

import * as n from "node-opcua-numeric-range";

export async function generate(
    filename: string,
    generatedTypescriptFilename: string
) {

    try {

        const content = await readFile(filename, "ascii");

        const typeDictionary = await parseBinaryXSD2(content,[ getStandartDataTypeFactory() ]);

        for (const key in typeDictionary.structuredTypes) {

            if (!typeDictionary.structuredTypes.hasOwnProperty(key)) {
                continue;
            }
            const structuredType = typeDictionary.structuredTypes[key];

            /*
                        prepareStructureType(structuredType, typeDictionary);

                        const structuredTypeSchema: StructuredTypeSchema = buildStructuredType(structuredType);
                        typeDictionary.structuredTypes[key] = structuredTypeSchema;
            */
            // reapply recursive schema on field
            for (const field of structuredType.fields) {
                if (field.category === FieldCategory.complex && field.fieldType === structuredType.name) {
                    field.schema = structuredType;
                }
            }
        }

        write(`// tslint:disable:no-this-assignment
// tslint:disable:max-classes-per-file
// tslint:disable:no-empty-interface
// tslint:disable:no-trailing-whitespace
// tslint:disable:array-type
// tslint:disable:object-literal-sort-keys
// tslint:disable:max-line-length

import * as _ from "underscore";

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
    decodeUInt8, Double,
    encodeArray, encodeBoolean,
    encodeByte, encodeByteString,
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
    decodeStatusCode, encodeStatusCode, StatusCode
} from "node-opcua-status-code";
import {
    decodeVariant, encodeVariant, Variant, VariantLike,
    VariantOptions
} from "node-opcua-variant";`);

        write(``);

        write(`export class DataTypeDefinition extends BaseUAObject {`);
        write(`    constructor(options: any) {`);
        write(`        super();`);
        write(`    }`);
        write(`}`);
        write(``);

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

        function processStructuredType(structuredType: StructuredTypeSchema): void {
            if (alreadyDone[structuredType.name]) {
                return;
            }
            alreadyDone[structuredType.name] = structuredType;
            // make sure
            if (typeDictionary.structuredTypes[structuredType.baseType]) {
                processStructuredType(typeDictionary.structuredTypes[structuredType.baseType]);
            }

            for (const field of structuredType.fields) {
                if (field.category === FieldCategory.complex) {
                    const fieldSchema = typeDictionary.structuredTypes[field.fieldType];
                    processStructuredType(fieldSchema);
                }
                if (field.category === FieldCategory.enumeration) {
                    const fieldSchema = typeDictionary.enumeratedTypes[field.fieldType];
                    processEnumeratedType(fieldSchema);
                }
            }
            writeStructuredTypeWithSchema(structuredType);
        }

        processStructuredType(typeDictionary.structuredTypes["LocalizedText"]);
        processStructuredType(typeDictionary.structuredTypes["AxisInformation"]);
        processStructuredType(typeDictionary.structuredTypes["DiagnosticInfo"]);

        processStructuredType(typeDictionary.structuredTypes["SimpleAttributeOperand"]);

        for (const structureType in typeDictionary.structuredTypes) {
            if (!typeDictionary.structuredTypes.hasOwnProperty(structureType)) {
                continue;
            }
            processStructuredType(typeDictionary.structuredTypes[structureType]);
            // if (++i > 250) { break; }
        }

        write(``);
        f.saveFormat(generatedTypescriptFilename, (code) => {
            // const options: prettier.Options = {
            //     printWidth: 120,
            //     parser: "typescript",
            //     insertPragma: true,
            //     bracketSpacing: true
            // };
            return code;
            // return prettier.format(code, options).replace("\n",os.EOL);
        });
    } catch (err) {
        throw err;
    }
}
