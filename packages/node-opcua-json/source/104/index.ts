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

/**
 * The OPC UA 1.04 JSON encoding (Part 6, "reversible" and "non-reversible" forms), exposed
 * under version-free names: `import { opcuaJsonEncodeDataValue } from "node-opcua-json/104"`.
 *
 * Everything here is locked to 1.04: the encoders take a JsonEncoderMode (Reversible or
 * NonReversible) and the JSON types are the 1.04 shapes (Type/Body, TypeId/Body, NodeId objects).
 * The root "node-opcua-json" entry point dispatches on JsonEncodingScheme and accepts either edition.
 */

import type { ExtensionObject } from "node-opcua-extension-object";
import type { Pojo } from "../decode_opcua_json.js";
import type { ExtensionObjectBuilder } from "../json_basic_encoding_body_functor.js";
import {
    type ExtensionObjectJSON104,
    opcuaJsonDecodeExtensionObject as opcuaJsonDecodeExtensionObjectAny,
    opcuaJsonEncodeExtensionObject as opcuaJsonEncodeExtensionObjectAny
} from "../json_basic_encoding_decoding_extension_object.js";
import { type JsonEncoderMode104, toJsonEncodingScheme } from "../json_encoding_scheme.js";

// version-agnostic parts, shared with the root entry point
export * from "../decode_opcua_json.js";
export type { ExtensionObjectConstructorFuncWithSchema } from "../extension_object_constructor.js";
export * from "../json_basic_encoding_body_functor.js";
export * from "../json_basic_encoding_decoding_byte_string.js";
// DataValue
export {
    type DataValueJSON104 as DataValueJSON,
    type DataValueStatusAndTimestamps,
    opcuaJsonDecodeDataValue104 as opcuaJsonDecodeDataValue,
    opcuaJsonEncodeDataValue104 as opcuaJsonEncodeDataValue,
    opcuaJsonEncodeDataValueMQTT104 as opcuaJsonEncodeDataValueMQTT
} from "../json_basic_encoding_decoding_data_value.js";
export * from "../json_basic_encoding_decoding_date_time.js";
export * from "../json_basic_encoding_decoding_diagnosticinfo.js";
// ExtensionObject
export {
    type ExtensionObjectJSON104 as ExtensionObjectJSON,
    makeBody,
    opcuaJsonDecodeExtensionObjectBody,
    opcuaJsonEncodeExtensionObjectBody
} from "../json_basic_encoding_decoding_extension_object.js";
export * from "../json_basic_encoding_decoding_int64.js";
export * from "../json_basic_encoding_decoding_localizedtext.js";
// NodeId
export {
    type NodeIdJSON104 as NodeIdJSON,
    opcuaDecodeURIComponent,
    opcuaEncodeURIComponent,
    opcuaJsonDecodeExpandedNodeId,
    opcuaJsonDecodeNodeId,
    opcuaJsonEncodeExpandedNodeId104 as opcuaJsonEncodeExpandedNodeId,
    opcuaJsonEncodeNodeId104 as opcuaJsonEncodeNodeId
} from "../json_basic_encoding_decoding_nodeid.js";
export * from "../json_basic_encoding_decoding_qualifiedname.js";

// StatusCode
export {
    opcuaJsonDecodeStatusCode,
    opcuaJsonEncodeStatusCode104 as opcuaJsonEncodeStatusCode,
    type StatusCodeJSON
} from "../json_basic_encoding_decoding_statuscode.js";
// Variant
export {
    opcuaJsonDecodeVariant104 as opcuaJsonDecodeVariant,
    opcuaJsonEncodeVariant104 as opcuaJsonEncodeVariant,
    type VariantJSON104 as VariantJSON,
    type VariantJSONBody,
    type VariantJSONBodyScalar
} from "../json_basic_encoding_decoding_variant.js";
export { JsonEncoderMode104 as JsonEncoderMode, JsonEncodingScheme, toJsonEncodingScheme } from "../json_encoding_scheme.js";

/**
 * encode an ExtensionObject with the 1.04 rules: Reversible yields { TypeId, Body },
 * NonReversible yields the bare body.
 */
export function opcuaJsonEncodeExtensionObject(
    extensionObject: ExtensionObject | ExtensionObject[] | null,
    mode: JsonEncoderMode104,
    namespaceArray?: string[]
): ExtensionObjectJSON104 | Pojo | (ExtensionObjectJSON104 | Pojo)[] | null {
    return opcuaJsonEncodeExtensionObjectAny(extensionObject, toJsonEncodingScheme(mode), namespaceArray) as
        | ExtensionObjectJSON104
        | Pojo
        | (ExtensionObjectJSON104 | Pojo)[]
        | null;
}

export function opcuaJsonDecodeExtensionObject(
    pojo: ExtensionObjectJSON104,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): ExtensionObject | ExtensionObject[] | null {
    return opcuaJsonDecodeExtensionObjectAny(pojo, builder, namespaceArray);
}
