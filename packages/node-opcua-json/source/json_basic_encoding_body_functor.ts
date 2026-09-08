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

import type { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import type { ExtensionObjectConstructorFuncWithSchema } from "./extension_object_constructor.js";

import { opcuaJsonDecodeByteString, opcuaJsonEncodeByteString } from "./json_basic_encoding_decoding_byte_string.js";
import { opcuaJsonDecodeDataValue, opcuaJsonEncodeDataValue } from "./json_basic_encoding_decoding_data_value.js";
import { opcuaJsonDecodeDateTime, opcuaJsonEncodeDateTime } from "./json_basic_encoding_decoding_date_time.js";
import { opcuaJsonDecodeExtensionObject, opcuaJsonEncodeExtensionObject } from "./json_basic_encoding_decoding_extension_object.js";
import {
    opcuaJsonDecodeInt64,
    opcuaJsonDecodeUInt64,
    opcuaJsonEncodeInt64,
    opcuaJsonEncodeUInt64
} from "./json_basic_encoding_decoding_int64.js";
import { opcuaJsonDecodeLocalizedText, opcuaJsonEncodeLocalizedText } from "./json_basic_encoding_decoding_localizedtext.js";
import {
    opcuaJsonDecodeExpandedNodeId,
    opcuaJsonDecodeNodeId,
    opcuaJsonEncodeExpandedNodeId,
    opcuaJsonEncodeNodeId
} from "./json_basic_encoding_decoding_nodeid.js";
import { opcuaJsonDecodeQualifiedName, opcuaJsonEncodeQualifiedName } from "./json_basic_encoding_decoding_qualifiedname.js";
import { opcuaJsonDecodeStatusCode, opcuaJsonEncodeStatusCode } from "./json_basic_encoding_decoding_statuscode.js";
import { opcuaJsonDecodeVariant, opcuaJsonEncodeVariant } from "./json_basic_encoding_decoding_variant.js";
import { JsonEncodingScheme } from "./json_encoding_scheme.js";

export type EncoderFunc<T> = (t: T, encodingScheme: JsonEncodingScheme, namespaceArray?: string[]) => unknown;

export interface ExtensionObjectBuilder {
    getExtensionObjectConstructor(dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema;
}
export type DecoderFunc<T> = (t: T, builder: ExtensionObjectBuilder, namespaceArray: string[]) => unknown;

function opcuaJsonEncodeString(a: string, scheme: JsonEncodingScheme): string | undefined {
    switch (scheme) {
        case JsonEncodingScheme.DeprecatedReversible:
            return a;
        case JsonEncodingScheme.DeprecatedNonReversible:
            return a;
        case JsonEncodingScheme.Verbose:
            return a;
        case JsonEncodingScheme.Compact:
            if (a === "" || a === undefined || a === null) {
                return undefined;
            }
            return a;
        default:
            throw new Error(`Unknown JsonEncodingScheme: ${scheme}`);
    }
}

function opcuaJsonEncodeGuid(a: string, scheme: JsonEncodingScheme): string | undefined {
    switch (scheme) {
        case JsonEncodingScheme.DeprecatedReversible:
            return a.toLowerCase();
        case JsonEncodingScheme.DeprecatedNonReversible:
            return a.toLowerCase();
        case JsonEncodingScheme.Verbose:
            return a.toLowerCase();
        case JsonEncodingScheme.Compact:
            if (a === "00000000-0000-0000-0000-000000000000") {
                return undefined;
            }
            return a.toLowerCase();
        default:
            throw new Error(`Unknown JsonEncodingScheme: ${scheme}`);
    }
}

export function bodyEncodeFunctor(dataType: DataType): EncoderFunc<unknown> {
    switch (dataType) {
        case DataType.Null:
            return () => null;
        case DataType.Boolean:
        case DataType.Byte:
        case DataType.Double:
        case DataType.Float:
        case DataType.Int16:
        case DataType.Int32:
        case DataType.SByte:
        case DataType.UInt16:
        case DataType.UInt32:
            return (a: unknown) => a;
        case DataType.Guid:
            return opcuaJsonEncodeGuid as EncoderFunc<unknown>;
        case DataType.String:
            return opcuaJsonEncodeString as EncoderFunc<unknown>;
        case DataType.ByteString:
            return opcuaJsonEncodeByteString as EncoderFunc<unknown>;
        case DataType.LocalizedText:
            return opcuaJsonEncodeLocalizedText as EncoderFunc<unknown>;
        case DataType.NodeId:
            return opcuaJsonEncodeNodeId as EncoderFunc<unknown>;
        case DataType.ExpandedNodeId:
            return opcuaJsonEncodeExpandedNodeId as EncoderFunc<unknown>;
        case DataType.QualifiedName:
            return opcuaJsonEncodeQualifiedName as EncoderFunc<unknown>;
        case DataType.StatusCode:
            return opcuaJsonEncodeStatusCode as EncoderFunc<unknown>;
        case DataType.DateTime:
            return opcuaJsonEncodeDateTime as EncoderFunc<unknown>;
        case DataType.ExtensionObject:
            return opcuaJsonEncodeExtensionObject as EncoderFunc<unknown>;
        case DataType.Variant:
            return opcuaJsonEncodeVariant as EncoderFunc<unknown>;
        case DataType.Int64:
            return opcuaJsonEncodeInt64 as EncoderFunc<unknown>;
        case DataType.UInt64:
            return opcuaJsonEncodeUInt64 as EncoderFunc<unknown>;
        case DataType.DataValue:
            return opcuaJsonEncodeDataValue as EncoderFunc<unknown>;
        case DataType.DiagnosticInfo:
        case DataType.XmlElement:
            throw new Error(`Unsupported yet ${DataType[dataType]}`);
        default:
            return () => null;
    }
}

export function bodyDecodeFunctor(dataType: DataType): DecoderFunc<unknown> {
    switch (dataType) {
        case DataType.Null:
            return () => null;
        case DataType.Boolean:
        case DataType.Byte:
        case DataType.Double:
        case DataType.Float:
        case DataType.Guid:
        case DataType.Int16:
        case DataType.Int32:
        case DataType.SByte:
        case DataType.String:
        case DataType.UInt16:
        case DataType.UInt32:
            return ((a: boolean | number | string) => a) as DecoderFunc<unknown>;
        case DataType.ByteString:
            return opcuaJsonDecodeByteString as DecoderFunc<unknown>;
        case DataType.LocalizedText:
            return opcuaJsonDecodeLocalizedText as DecoderFunc<unknown>;
        case DataType.NodeId:
            return opcuaJsonDecodeNodeId as DecoderFunc<unknown>;
        case DataType.ExpandedNodeId:
            return opcuaJsonDecodeExpandedNodeId as DecoderFunc<unknown>;
        case DataType.QualifiedName:
            return opcuaJsonDecodeQualifiedName as DecoderFunc<unknown>;
        case DataType.StatusCode:
            return opcuaJsonDecodeStatusCode as DecoderFunc<unknown>;
        case DataType.DateTime:
            return opcuaJsonDecodeDateTime as DecoderFunc<unknown>;
        case DataType.ExtensionObject:
            return opcuaJsonDecodeExtensionObject as DecoderFunc<unknown>;
        case DataType.Variant:
            return opcuaJsonDecodeVariant as DecoderFunc<unknown>;
        case DataType.Int64:
            return opcuaJsonDecodeInt64 as DecoderFunc<unknown>;
        case DataType.UInt64:
            return opcuaJsonDecodeUInt64 as DecoderFunc<unknown>;
        case DataType.DataValue:
            return opcuaJsonDecodeDataValue as DecoderFunc<unknown>;
        case DataType.DiagnosticInfo:
        case DataType.XmlElement:
            throw new Error(`Unsupported yet ${DataType[dataType]}`);
        default:
            return () => null;
    }
}
