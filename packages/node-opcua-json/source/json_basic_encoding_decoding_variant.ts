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
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import type { Pojo } from "./decode_opcua_json.js";
import { bodyDecodeFunctor, bodyEncodeFunctor, type ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import { JsonEncoderMode104, JsonEncoderMode105, JsonEncodingScheme } from "./json_encoding_scheme.js";

export type VariantJSONBodyScalar = Pojo | number | string | boolean | null | Date;
export type VariantJSONBody = VariantJSONBodyScalar | VariantJSONBodyScalar[];

// https://reference.opcfoundation.org/Core/Part6/v104/docs/5.4.2.17
export interface VariantJSON104 {
    /**
     * The Built-in type for the value contained in the Body encoded as JSON number.
     * If type is 0 (NULL) the Variant contains a NULL value and the containing JSON
     *  object shall be omitted or replaced by the JSON literal ‘null’ (when an element of a JSON array).
     */
    Type: DataType;
    /**
     * If the value is a scalar it is encoded using the rules for type specified for the Type.
     * If the value is a one-dimensional array it is encoded as JSON array.
     * Multi-dimensional arrays are encoded as a one dimensional JSON array which is
     * reconstructed using the value of the Dimensions field (see 5.2.2.16).
     */
    Body: VariantJSONBody;

    /**
     * The dimensions of the array encoded as an JSON array of JSON numbers.
     * The Dimensions are omitted for scalar and one-dimensional array values.
     */
    Dimensions?: number[];
}

// https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4.2.17
export interface VariantJSON105 {
    /**
     * The Built-in type for the value contained in the Body (see Table 1) encoded as JSON number.
     */
    UaType: DataType;
    /**
   * If the value is a scalar, it is encoded using the rules for type specified for the Type.
   * 
   * If the value is a one-dimensional array it is e  const Value = body(variant, scheme, builder, namespaceArray);
ncoded as JSON array (see 5.4.5)
   * 
   * Multi-dimensional arrays are encoded as a JSON array containing all elements. 
   * The mapping of a multidimensional array to a flat list is described in 5.2.2.16.
   * The field is not encoded if the value is a NULL for nullable Built-in types (see Table 1)
   * 
   * 5.4.5
   * 
   * One dimensional Arrays shall be encoded as JSON arrays.
   * If an element is NULL, the element shall be encoded as the JSON literal ‘null’.
   * Otherwise, the element is encoded according to the rules defined for the type.
   * 
   * Multidimensional Arrays are encoded as JSON object with the fields defined in 
   * Table 43.
   * 
   * Table 43.
   * Name           Description  const Value = body(variant, scheme, builder, namespaceArray);

   * ---------      ---------------------------------------------------
   * Array          Multi-dimensional arrays are encoded as a one-dimensional 
   *                JSON array which is reconstructed using the value of the 
   *                Dimensions field (see 5.2.2.16).
   * Dimensions     The dimensions of the array encoded as a JSON array of JSON numbers.
   */
    Value?: VariantJSONBody;

    /**
     * The dimensions of the array encoded as a JSON array of JSON numbers.
     */
    UaDimensions?: number[];
}
export type VariantJSON = (VariantJSON104 & { UaType: undefined }) | (VariantJSON105 & { Type: undefined });

// Array
// If an element is NULL, the element shall be encoded as the JSON literal ‘null’.
// Otherwise, the element is encoded according to the rules defined for the type.
// Multi-dimensional Arrays are encoded as nested JSON arrays.
// The outer array is the first dimension and the innermost array is the last dimension.

function body(variant: Variant, scheme: JsonEncodingScheme, namespaceArray?: string[]): VariantJSONBody {
    const f = bodyEncodeFunctor(variant.dataType);
    if (variant.arrayType === VariantArrayType.Scalar) {
        return f(variant.value, scheme, namespaceArray) as VariantJSONBody;
    } else {
        const array: VariantJSONBodyScalar[] = [];
        for (const e of variant.value) {
            array.push(f(e, scheme, namespaceArray) as VariantJSONBodyScalar);
        }
        return array;
    }
}

export function opcuaJsonEncodeVariant105(variant: Variant, mode: JsonEncoderMode105, namespaceArray?: string[]): VariantJSON105 {
    /**
     * For the non-reversible form, Variant values shall be encoded as a JSON object containing only
     * the value of the Body field. The Type and Dimensions fields are dropped. Multi-dimensional
     * arrays are encoded as a multi dimensional JSON array.
     */
    if (variant.dataType === DataType.Null && variant.arrayType === VariantArrayType.Scalar) {
        if (mode === JsonEncoderMode105.Compact) {
            return <VariantJSON105>{
                UaType: DataType.Null
            };
        } else {
            return <VariantJSON105>{ UaType: DataType.Null, Value: null };
        }
    }
    const scheme = mode === JsonEncoderMode105.Compact ? JsonEncodingScheme.Compact : JsonEncodingScheme.Verbose;

    const Value = body(variant, scheme, namespaceArray);
    const pojo: VariantJSON105 = {
        UaType: variant.dataType
        //    Value: body(variant, scheme, namespaceArray),
    };
    if (Value !== undefined) {
        pojo.Value = Value;
    }
    if (variant.arrayType === VariantArrayType.Matrix && variant.dimensions) {
        pojo.UaDimensions = [...variant.dimensions];
    }
    if (mode === JsonEncoderMode105.Compact && variant.arrayType === VariantArrayType.Scalar) {
        // remove default values for compact encoding
        switch (variant.dataType) {
            case DataType.Boolean:
                if (pojo.Value === false) {
                    // remove false value for compact encoding
                    delete (pojo as { Value: unknown }).Value;
                }
                break;
            case DataType.SByte:
            case DataType.Byte:
            case DataType.Int16:
            case DataType.UInt16:
            case DataType.Int32:
            case DataType.UInt32:
            case DataType.Float:
            case DataType.Double:
                if (pojo.Value === 0) {
                    // remove 0 value for compact encoding
                    delete (pojo as { Value: unknown }).Value;
                }
                break;
            case DataType.String:
                if (pojo.Value === "") {
                    // remove empty string for compact encoding
                    delete (pojo as { Value: unknown }).Value;
                }
                break;
            case DataType.Int64:
            case DataType.UInt64:
            case DataType.DateTime:
            case DataType.Guid:
            case DataType.ByteString:
            case DataType.XmlElement:
            case DataType.NodeId:
            case DataType.QualifiedName:
            case DataType.LocalizedText:
            case DataType.ExtensionObject:
            case DataType.StatusCode:
                // these are all scalar types, so we can remove the UaType
                // delete pojo.UaType;
                break;
        }
    }
    return pojo;
}

export function opcuaJsonEncodeVariant104(
    variant: Variant,
    mode: JsonEncoderMode104 = JsonEncoderMode104.NonReversible,
    namespaceArray: string[]
): VariantJSON104 | VariantJSONBody | null {
    /**
     * For the non-reversible form, Variant values shall be encoded as a JSON object containing only
     * the value of the Body field. The Type and Dimensions fields are dropped. Multi-dimensional
     * arrays are encoded as a multi dimensional JSON array.
     */
    if (variant.dataType === DataType.Null) {
        return null;
    }
    const reversible = mode === JsonEncoderMode104.Reversible;
    const scheme =
        mode === JsonEncoderMode104.Reversible
            ? JsonEncodingScheme.DeprecatedReversible
            : JsonEncodingScheme.DeprecatedNonReversible;

    if (!reversible && variant.arrayType !== VariantArrayType.Matrix) {
        return body(variant, scheme, namespaceArray);
    }

    const pojo: VariantJSON104 = {
        Type: variant.dataType,
        Body: body(variant, scheme, namespaceArray)
    };
    if (variant.arrayType === VariantArrayType.Matrix && variant.dimensions) {
        pojo.Dimensions = [...variant.dimensions];
    }
    return pojo;
}

export function opcuaJsonEncodeVariant(
    variant: Variant,
    scheme: JsonEncodingScheme.Compact | JsonEncodingScheme.Verbose,
    namespaceArray: string[]
): VariantJSONBody | null;
export function opcuaJsonEncodeVariant(
    variant: Variant,
    scheme: JsonEncodingScheme.Verbose,
    namespaceArray: string[]
): VariantJSON105;
export function opcuaJsonEncodeVariant(
    variant: Variant,
    scheme: JsonEncodingScheme.DeprecatedNonReversible | JsonEncodingScheme.DeprecatedReversible,
    namespaceArray: string[]
): VariantJSON104 | null;
export function opcuaJsonEncodeVariant(
    variant: Variant,
    scheme: JsonEncodingScheme = JsonEncodingScheme.Compact,
    namespaceArray: string[]
) {
    switch (scheme) {
        case JsonEncodingScheme.Compact:
            return opcuaJsonEncodeVariant105(variant, JsonEncoderMode105.Compact, namespaceArray);
        case JsonEncodingScheme.Verbose:
            return opcuaJsonEncodeVariant105(variant, JsonEncoderMode105.Verbose, namespaceArray);
        case JsonEncodingScheme.DeprecatedReversible:
            return opcuaJsonEncodeVariant104(variant, JsonEncoderMode104.Reversible, namespaceArray);
        case JsonEncodingScheme.DeprecatedNonReversible:
            return opcuaJsonEncodeVariant104(variant, JsonEncoderMode104.NonReversible, namespaceArray);
        default:
            throw new Error("Unknown JsonEncodingScheme");
    }
}
export function opcuaJsonDecodeVariant104(
    pojo: VariantJSON104 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): Variant {
    if (!pojo) {
        return new Variant({ dataType: DataType.Null });
    }
    const dataType = pojo.Type as DataType;
    const f = bodyDecodeFunctor(dataType);
    if (Array.isArray(pojo.Body)) {
        const value = pojo.Body.map((a) => f(a, builder, namespaceArray));

        if (pojo.Dimensions) {
            return new Variant({
                arrayType: VariantArrayType.Matrix,
                dimensions: pojo.Dimensions,
                dataType,
                value
            });
        }
        return new Variant({
            arrayType: VariantArrayType.Array,
            dataType,
            value
        });
    }
    return new Variant({
        dataType,
        arrayType: VariantArrayType.Scalar,
        value: f ? f(pojo.Body, builder, namespaceArray) : null
    });
}

export function opcuaJsonDecodeVariant105(
    pojo: VariantJSON105 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): Variant {
    if (!pojo) {
        return new Variant({ dataType: DataType.Null });
    }
    const dataType = pojo.UaType as DataType;
    const f = bodyDecodeFunctor(dataType);
    if (Array.isArray(pojo.Value)) {
        const value = pojo.Value.map((a) => f(a, builder, namespaceArray));

        if (pojo.UaDimensions) {
            return new Variant({
                arrayType: VariantArrayType.Matrix,
                dimensions: pojo.UaDimensions,
                dataType,
                value
            });
        }
        return new Variant({
            arrayType: VariantArrayType.Array,
            dataType,
            value
        });
    }
    return new Variant({
        dataType,
        arrayType: VariantArrayType.Scalar,
        value: f ? f(pojo.Value, builder, namespaceArray) : null
    });
}
export function opcuaJsonDecodeVariant(
    pojo: VariantJSON105 | VariantJSON104 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): Variant {
    if (!pojo) {
        return new Variant({ dataType: DataType.Null });
    }
    if ("Type" in pojo || !("UaType" in pojo)) {
        return opcuaJsonDecodeVariant104(pojo, builder, namespaceArray);
    } else if ("UaType" in pojo) {
        return opcuaJsonDecodeVariant105(pojo, builder, namespaceArray);
    }
    throw new Error("Invalid Variant JSON format");
}
