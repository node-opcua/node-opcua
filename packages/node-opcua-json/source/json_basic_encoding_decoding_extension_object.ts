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

import type { UAString } from "node-opcua-basic-types";
import type { DiagnosticInfoOptions, LocalizedTextOptions, QualifiedNameOptions } from "node-opcua-data-model";
import { DataValue, type DataValueOptions } from "node-opcua-data-value";
import { make_errorLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import {
    BasicTypeSchema,
    type FieldType,
    getStandardDataTypeFactory,
    type IStructuredTypeSchema,
    type StructuredTypeSchema
} from "node-opcua-factory";
import type { NodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { DataType, type VariantOptions } from "node-opcua-variant";
import type { Pojo } from "./decode_opcua_json.js";
import {
    bodyDecodeFunctor,
    bodyEncodeFunctor,
    type DecoderFunc,
    type EncoderFunc,
    type ExtensionObjectBuilder
} from "./json_basic_encoding_body_functor.js";
import { type NodeIdJSON, opcuaJsonDecodeNodeId, opcuaJsonEncodeNodeId } from "./json_basic_encoding_decoding_nodeid.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

const errorLog = make_errorLog("JSON");

export interface ExtensionObjectJSON104 {
    TypeId: NodeIdJSON;
    Body: Pojo;
    UaTypeId?: never;
    UaBody?: never;
}
export interface ExtensionObjectJSON105 {
    UaTypeId: NodeIdJSON;
    UaBody: Pojo;
    TypeId?: never;
    Body?: never;
}
export type ExtensionObjectJSON = ExtensionObjectJSON104 | ExtensionObjectJSON105;

const g_DataType = DataType as unknown as Record<string | number, DataType>;
function toDataType(field: FieldType): DataType {
    if (field.category === "enumeration") {
        return DataType.Int32; // enumeration is always Int32
    }
    let dataType: DataType | undefined = g_DataType[field.fieldType];
    if (dataType === undefined) {
        dataType = field.basicDataType as DataType | undefined;
        if (dataType === undefined) {
            if (field.schema instanceof BasicTypeSchema) {
                dataType = g_DataType[field.schema.subType] || g_DataType[field.schema.name];
            } else {
                dataType = g_DataType[field.schema.name];
                if (!dataType) {
                    g_DataType[(field.schema as unknown as { subType: string }).subType];
                }
            }
        }
    }
    return dataType;
}

function encodeNumericRange(numericRange: NumericRange, _scheme: JsonEncodingScheme): string | null | undefined {
    return numericRange.toEncodeableString();
}

function findEncoder(field: FieldType): EncoderFunc<unknown> | null {
    const dataType: DataType = toDataType(field);

    if (dataType === DataType.String) {
        // like basic : NumericRange
        if (field.fieldType === "NumericRange") {
            return encodeNumericRange as EncoderFunc<unknown>;
        }
    }
    if (!dataType) {
        if (field.fieldType === "UAString") {
            return ((str: UAString, _scheme: JsonEncodingScheme, _namespaceArray?: string[]) => {
                return str;
            }) as EncoderFunc<unknown>;
        }
    }
    const encoderFunc = (() => {
        switch (field.category) {
            case "complex":
                if (field.fieldType === "ExtensionObject") {
                    return opcuaJsonEncodeExtensionObject;
                } else {
                    return opcuaJsonEncodeExtensionObjectBody;
                }
            case "basic":
                return bodyEncodeFunctor(dataType);
            default:
                return (a: number) => a;
        }
    })();

    // istanbul ignore next
    if (!encoderFunc) {
        errorLog("findEncoder: Cannot find encoderFunc for ", DataType[dataType], field);
        return null;
    }
    return encoderFunc as EncoderFunc<unknown>;
}

function findDecoder(field: FieldType): DecoderFunc<unknown> | null {
    const dataType = toDataType(field);
    if (dataType === DataType.String) {
        // like basic : NumericRange
        if (field.fieldType === "NumericRange") {
            return ((numericRange: string) => {
                return new NumericRange(numericRange);
            }) as DecoderFunc<unknown>;
        }
    }
    if (!dataType) {
        if (field.fieldType === "UAString") {
            return ((str: UAString) => {
                return str;
            }) as DecoderFunc<unknown>;
        }
        //   dataType = toDataType((field.schema as unknown as { subType: string }).subType);
    }
    const decoderFunc = (() => {
        switch (field.category) {
            case "complex":
                if (field.fieldType === "ExtensionObject") {
                    return opcuaJsonDecodeExtensionObject;
                } else {
                    if (field.schema) {
                        return opcuaJsonDecodeExtensionObjectBody.bind(null, field.schema as StructuredTypeSchema);
                    } else {
                        const factory = getStandardDataTypeFactory();
                        const schema = factory.getStructuredTypeSchema(field.fieldType);
                        return opcuaJsonDecodeExtensionObjectBody.bind(null, schema);
                    }
                }
            case "basic":
                return bodyDecodeFunctor(dataType);
            default:
                return (a: number) => a;
        }
    })();
    // istanbul ignore next
    if (!decoderFunc) {
        errorLog("findEncoder: Cannot find decoderFunc for ", DataType[dataType], field);
        return null;
    }
    return decoderFunc as DecoderFunc<unknown>;
}

function getAllExtensionObjectFields1(schema: IStructuredTypeSchema): FieldType[] {
    const baseSchema = schema.getBaseSchema();
    const baseFields: FieldType[] = baseSchema ? getAllExtensionObjectFields1(baseSchema) : ([] as FieldType[]);
    return [...baseFields, ...schema.fields];
}

function getAllExtensionObjectFields(extensionObject: ExtensionObject) {
    return getAllExtensionObjectFields1(extensionObject.schema);
}

interface ExtensionObjectWithOptionalSwitchField extends ExtensionObject {
    switchField?: number;
}
export function makeBody(extensionObject: ExtensionObject, scheme: JsonEncodingScheme): Pojo | undefined {
    const switchField = (extensionObject as ExtensionObjectWithOptionalSwitchField).switchField;
    const isUnion = switchField !== undefined;

    const pojo: Pojo = {};
    if (isUnion) {
        pojo.SwitchField = switchField;
    }
    const fields = getAllExtensionObjectFields(extensionObject);

    let allAreDefault = true;

    for (const field of fields) {
        const value = (extensionObject as unknown as Record<string, unknown>)[field.name];
        const encoder = findEncoder(field);

        const fieldName = isUnion ? "Value" : field.originalName;

        // istanbul ignore next
        if (!encoder) {
            errorLog("cannot find encoder for field", field);
            continue;
        }
        if (field.isArray) {
            if (!value) {
                // xx pojo[name] = null;
            } else if (typeof value === "object" && value && (value as { length?: number }).length === 0) {
                if (scheme === JsonEncodingScheme.Compact) {
                    // encoding empty array as undefined in compact mode
                } else {
                    pojo[fieldName] = [];
                }
            } else {
                const valueAsArray = value as unknown[];
                // in array default value must be explicitly set to default
                pojo[fieldName] = valueAsArray.map((a: unknown) => (a !== undefined && a !== null ? encoder(a, scheme) : null));
                allAreDefault = false;
            }
        } else {
            if (value !== undefined) {
                const fieldValue = encoder(value, scheme);
                if (fieldValue !== undefined) {
                    pojo[fieldName] = fieldValue;
                    if (allAreDefault && !isDefault(field, fieldValue)) {
                        allAreDefault = false;
                    }
                }
            }
        }
    }
    if (allAreDefault && scheme === JsonEncodingScheme.Compact) {
        return undefined;
    }
    return pojo;
}

function isDefault(field: FieldType, value: unknown): boolean {
    if (value === undefined || value === null) {
        return true; // undefined or null is always default
    }
    const dataType = toDataType(field);
    // detect if the filedl
    switch (dataType) {
        case DataType.Null:
            // a null value was already answered above; a non-null one of the Null type is not
            // a default, and there is nothing else it could be
            return false;
        case DataType.Boolean:
            return value === false;
        case DataType.Byte:
        case DataType.Int16:
        case DataType.Int32:
        case DataType.UInt16:
        case DataType.UInt32:
        case DataType.Float:
        case DataType.Double:
        case DataType.SByte:
            return value === 0;
        case DataType.Int64:
        case DataType.UInt64:
            if (typeof value === "number") {
                return value === 0;
            } else if (typeof value === "bigint") {
                return value === BigInt(0);
            } else if (Array.isArray(value) && value.length === 2) {
                return value[0] === 0 && value[1] === 0;
            }
            return false;
        case DataType.DateTime:
            return !value || (value instanceof Date && value.getTime() === 0);
        case DataType.String:
            return !value || value === "";
        case DataType.LocalizedText:
            return !value || (!(value as LocalizedTextOptions).text && !(value as LocalizedTextOptions).locale);
        case DataType.NodeId:
            return (
                !value || (!(value as NodeId).identifierType && (value as NodeId).namespace === 0 && (value as NodeId).value === 0)
            );
        case DataType.Guid:
            return !value || value === "00000000-0000-0000-0000-000000000000";
        case DataType.QualifiedName:
            return !value || (!(value as QualifiedNameOptions).name && (value as QualifiedNameOptions).namespaceIndex === 0);
        case DataType.ExtensionObject:
            // ExtensionObject is default if it has no body
            return !value || (Object.keys(value).length === 0 && value.constructor === ExtensionObject);
        case DataType.Variant:
            // Variant is default if it has no body
            return !value || (value as VariantOptions).dataType === DataType.Null;
        case DataType.DataValue:
            // DataValue is default if it has no body
            return (
                !value ||
                ((value as DataValueOptions).value === null &&
                    value instanceof DataValue &&
                    (value as DataValue).statusCode.value === 0 &&
                    (value as DataValueOptions).serverPicoseconds === 0 &&
                    (value as DataValueOptions).sourcePicoseconds === 0)
            );
        case DataType.DiagnosticInfo: {
            // DiagnosticInfo is default if it has no body
            const valueAsDiag = value as DiagnosticInfoOptions;
            return (
                valueAsDiag.symbolicId === 0 &&
                valueAsDiag.namespaceURI === 0 &&
                valueAsDiag.locale === 0 &&
                valueAsDiag.localizedText === 0 &&
                !valueAsDiag.additionalInfo &&
                !valueAsDiag.innerStatusCode &&
                !valueAsDiag.innerDiagnosticInfo
            );
        }
        case DataType.StatusCode: {
            // StatusCode is default if it has no body
            const valueAsStatusCode = value as {
                code: number;
                description?: string;
                symbol?: string;
            };
            return valueAsStatusCode.code === 0 && valueAsStatusCode.symbol === "Good" && valueAsStatusCode.description === "";
        }
        case DataType.ByteString:
            // ByteString is default if it has no body
            return value instanceof Buffer && value.length === 0;
        case DataType.XmlElement:
            // XmlElement is default if it has no body
            return typeof value === "string" && value.length === 0;
    }
    return false; // default value is not defined for this type
}

function adaptBody(
    body: Pojo,
    schema: IStructuredTypeSchema,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): Pojo | Pojo[] {
    if (Array.isArray(body)) {
        const result: Pojo[] = body.map((b) => adaptBody(b, schema, builder, namespaceArray) as Pojo);
        return result;
    }
    if (body === null || body === undefined) {
        return body;
    }

    const pojo: Pojo = {};
    const allFields = getAllExtensionObjectFields1(schema);
    const isUnion = body.SwitchField !== undefined;

    if (isUnion) {
        const field = allFields[body.SwitchField as number];
        const value = body.Value || body[field.originalName];
        const decoder = findDecoder(field);
        build(field, value, decoder);
        return pojo;
    }
    for (const field of allFields) {
        const value = body[field.originalName];
        // istanbul ignore next
        if (value === undefined) {
            continue;
        }
        const decoder = findDecoder(field);
        build(field, value, decoder);
    }
    return pojo;

    function build(field: FieldType, value: unknown, decoder?: DecoderFunc<unknown> | null) {
        if (!decoder) {
            errorLog("Cannot find decoder for", field);
            return;
        }
        if (field.isArray) {
            if (!value) {
                pojo[field.name] = [];
            } else if (typeof value === "object" && value && (value as { length?: number }).length === 0) {
                pojo[field.name] = [];
            } else {
                const valueAsArray = value as unknown[];
                pojo[field.name] = valueAsArray.map((a: unknown) => (a ? decoder(a as never, builder, namespaceArray) : undefined));
            }
        } else {
            if (value !== undefined && value !== null) {
                pojo[field.name] = decoder(value as never, builder, namespaceArray);
            } else if (value === null) {
                pojo[field.name] = null;
            }
        }
    }
}

export function opcuaJsonDecodeExtensionObjectBody(
    schema: IStructuredTypeSchema,
    body: Pojo,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[] = []
): Pojo | Pojo[] {
    const result = adaptBody(body, schema, builder, namespaceArray);
    return result;
}

export function opcuaJsonEncodeExtensionObjectBody(
    extensionObject: ExtensionObject | null,
    scheme: JsonEncodingScheme,
    _namespaceArray?: string[]
): ExtensionObjectJSON | Pojo | null | undefined {
    if (!extensionObject) {
        if (scheme === JsonEncodingScheme.Compact) {
            // Compact encoding does not encode empty ExtensionObject
            return undefined;
        }
        return null;
    }
    return makeBody(extensionObject, scheme);
}

/**
 *
 * ExtensionObject values shall be encoded as a JSON object with the fields shown:
 *
 * JSON Object - Definition for a ExtensionObject
 * Name	        Description
 * TypeId	    The NodeId of a DataTypeEncoding Node formatted using the rules in 5.4.2.10.
 * Encoding	    The format of the Body field encoded as a JSON number.
 *                 This value is 0 if the body is Structure encoded as a JSON object (see 5.4.6).
 *                 This value is 1 if the body is a ByteString value encoded as a JSON string (see 5.4.2.8).
 *                 This value is 2 if the body is a XmlElement value encoded as a JSON string (see 5.4.2.9).
 *                 This field is omitted if the value is 0.
 * Body	        Body of the ExtensionObject. The type of this field is specified by the Encoding field.
 *              If the Body is empty, the ExtensionObject is NULL and is omitted or encoded as a JSON null.
 *
 * For the non-reversible form, ExtensionObject values shall be encoded as a JSON object containing only
 * the value of the Body field. The TypeId and Encoding fields are dropped.
 */
export function opcuaJsonEncodeExtensionObject(
    extensionObject: ExtensionObject | ExtensionObject[] | null,
    scheme: JsonEncodingScheme,
    namespaceArray?: string[]
): ExtensionObjectJSON | Pojo | (ExtensionObjectJSON | Pojo)[] | null | undefined {
    if (!extensionObject) {
        if (scheme === JsonEncodingScheme.Compact) {
            // Compact encoding does not encode empty ExtensionObject
            return undefined;
        }
        return null;
    }

    if (Array.isArray(extensionObject)) {
        return extensionObject.map(singleItem);
    }
    return singleItem(extensionObject);

    function singleItem(extensionObject: ExtensionObject): ExtensionObjectJSON | Pojo {
        const body = opcuaJsonEncodeExtensionObjectBody(extensionObject, scheme, namespaceArray);
        const typeId = opcuaJsonEncodeNodeId(extensionObject.schema.dataTypeNodeId, scheme, namespaceArray);
        switch (scheme) {
            case JsonEncodingScheme.DeprecatedNonReversible:
                return body || {};
            case JsonEncodingScheme.DeprecatedReversible:
                return {
                    TypeId: typeId,
                    Body: body
                };
            case JsonEncodingScheme.Verbose:
            case JsonEncodingScheme.Compact:
                if ((body === undefined || body === null) && scheme === JsonEncodingScheme.Compact) {
                    return {
                        UaTypeId: typeId
                    };
                }
                return {
                    UaTypeId: typeId,
                    UaBody: body
                    // UaEncoding: 0, // always 0 for ExtensionObject in JSON  (omitted if Json)
                    // use UaEncoding: 1 for binary encoding => Base64 encoded ByteString
                    // use UaEncoding: 2 for binary encoding => string as XmlElement
                };
            default:
                throw new Error(`Unknown JsonEncodingScheme ${scheme}`);
        }
    }
}

export function opcuaJsonDecodeExtensionObject(
    _pojo: ExtensionObjectJSON104 | ExtensionObjectJSON105,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): ExtensionObject | ExtensionObject[] | null {
    if (!_pojo) {
        return null;
    }
    const dataTypeNodeId = opcuaJsonDecodeNodeId(_pojo.TypeId || _pojo.UaTypeId, builder, namespaceArray);
    const body = _pojo.Body || _pojo.UaBody;

    if (dataTypeNodeId.namespace === 0) {
        const factory = getStandardDataTypeFactory();
        const schema = factory.findStructureInfoForDataType(dataTypeNodeId);
        if (!schema) return null;
        const Constructor = schema.constructor;
        if (!Constructor) {
            return null;
        }
        const body2 = adaptBody(body, Constructor.schema, builder, namespaceArray);
        if (Array.isArray(body2)) {
            const result: ExtensionObject[] = body2.map((b) => new Constructor(b));
            return result;
        }
        return new Constructor(body2);
    } else {
        if (!builder) {
            throw new Error("Expecting a extension object builder for non-0 namespace extension objects");
        }
        const Constructor = builder.getExtensionObjectConstructor(dataTypeNodeId);
        const body2 = adaptBody(body, Constructor.schema, builder, namespaceArray);

        if (Array.isArray(body2)) {
            const result: ExtensionObject[] = body2.map((b) => new Constructor(b));
            return result;
        }
        return new Constructor(body2);
    }
}
