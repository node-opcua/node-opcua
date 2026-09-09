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

// version-locked realms: `node-opcua-json/104` and `node-opcua-json/105` expose the same
// API under version-free names (opcuaJsonEncodeDataValue, DataValueJSON, ...) bound to a
// single edition of Part 6, whereas this root entry point dispatches on JsonEncodingScheme.
export * as v104 from "./104/index.js";
export * as v105 from "./105/index.js";
export * from "./decode_opcua_json.js";
export type { ExtensionObjectConstructorFuncWithSchema } from "./extension_object_constructor.js";
export * from "./json_basic_encoding_body_functor.js";
export * from "./json_basic_encoding_decoding_byte_string.js";
export {
    type DataValueJSON,
    type DataValueJSON104,
    type DataValueJSON105,
    opcuaJsonDecodeDataValue,
    opcuaJsonDecodeDataValue104,
    opcuaJsonDecodeDataValue105,
    opcuaJsonEncodeDataValue,
    opcuaJsonEncodeDataValue104,
    opcuaJsonEncodeDataValue105,
    opcuaJsonEncodeDataValueMQTT,
    opcuaJsonEncodeDataValueMQTT104,
    opcuaJsonEncodeDataValueMQTT105
} from "./json_basic_encoding_decoding_data_value.js";
export * from "./json_basic_encoding_decoding_diagnosticinfo.js";
export * from "./json_basic_encoding_decoding_extension_object.js";
export {
    opcuaJsonDecodeExtensionObject,
    opcuaJsonEncodeExtensionObject
} from "./json_basic_encoding_decoding_extension_object.js";
export * from "./json_basic_encoding_decoding_int64.js";
export * from "./json_basic_encoding_decoding_localizedtext.js";
export * from "./json_basic_encoding_decoding_nodeid.js";
export * from "./json_basic_encoding_decoding_qualifiedname.js";
export * from "./json_basic_encoding_decoding_statuscode.js";
export {
    opcuaJsonDecodeVariant,
    opcuaJsonDecodeVariant104,
    // the explicit 1.05 entry points: the dispatcher above overloads Compact and Verbose together
    // and so cannot return the 1.05 object shape for Verbose alone
    opcuaJsonDecodeVariant105,
    opcuaJsonEncodeVariant,
    opcuaJsonEncodeVariant104,
    opcuaJsonEncodeVariant105,
    type VariantJSON,
    type VariantJSON104,
    type VariantJSON105
} from "./json_basic_encoding_decoding_variant.js";
export * from "./json_encoding_scheme.js";
