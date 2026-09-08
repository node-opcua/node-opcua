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

import type { UInt16 } from "node-opcua-basic-types";
import { DataValue, type DataValueOptions } from "node-opcua-data-value";
import { DataSetFieldContentMask } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import type { ExtensionObjectBuilder } from "./json_basic_encoding_body_functor.js";
import {
    opcuaJsonDecodeStatusCode,
    opcuaJsonEncodeStatusCode104,
    opcuaJsonEncodeStatusCode105,
    type StatusCodeJSON
} from "./json_basic_encoding_decoding_statuscode.js";
import {
    opcuaJsonDecodeVariant104,
    opcuaJsonDecodeVariant105,
    opcuaJsonEncodeVariant104,
    opcuaJsonEncodeVariant105,
    type VariantJSON104,
    type VariantJSON105,
    type VariantJSONBody
} from "./json_basic_encoding_decoding_variant.js";
import { JsonEncoderMode104, JsonEncoderMode105, JsonEncodingScheme, toJsonEncodingScheme } from "./json_encoding_scheme.js";

export interface DataValueStatusAndTimestamps {
    StatusCode?: StatusCodeJSON | number;

    /**
     * The source timestamp associated with the value.
     * Not encoded if the value is DateTime.MinValue.
     */
    SourceTimestamp?: Date; // DateTime
    /**
     * The number of 10 Picosecond intervals for the SourceTimestamp.
     * Not encoded if the value is 0.
     */
    SourcePicoseconds?: UInt16;
    /**
     * The server timestamp associated with the value.
     * Not encoded if the value is DateTime.MinValue.
     */
    ServerTimestamp?: Date;
    /**
     * The number of 10 Picosecond intervals for the ServerTimestamp.
     * Not encoded if the value is 0.
     */
    ServerPicoseconds?: UInt16;
}

// https://reference.opcfoundation.org/Core/Part6/v104/docs/5.4.2.18
export interface DataValueJSON104 extends DataValueStatusAndTimestamps {
    Value?: VariantJSON104 | null;
}

export interface DataValueJSON105 extends VariantJSON105, DataValueStatusAndTimestamps {}

export type DataValueJSON = DataValueJSON105;
function _setTimestampsAndStatusCode(
    pojo: DataValueStatusAndTimestamps,
    dataValue: DataValue,
    mask: DataSetFieldContentMask,
    mode: JsonEncodingScheme
): void {
    if (mask & DataSetFieldContentMask.ServerPicoSeconds && dataValue.serverPicoseconds) {
        pojo.ServerPicoseconds = dataValue.serverPicoseconds;
    }
    if (mask & DataSetFieldContentMask.SourcePicoSeconds && dataValue.sourcePicoseconds) {
        pojo.SourcePicoseconds = dataValue.sourcePicoseconds;
    }
    if (mask & DataSetFieldContentMask.ServerTimestamp && dataValue.serverTimestamp) {
        pojo.ServerTimestamp = dataValue.serverTimestamp;
    }
    if (mask & DataSetFieldContentMask.SourceTimestamp && dataValue.sourceTimestamp) {
        pojo.SourceTimestamp = dataValue.sourceTimestamp;
    }
    if (mask & DataSetFieldContentMask.StatusCode && dataValue.statusCode.value !== 0) {
        // statusCode is omitted if it is Good (0)
        // https://reference.opcfoundation.org/Core/Part6/v105/docs/5.4
        switch (mode) {
            case JsonEncodingScheme.DeprecatedNonReversible:
                pojo.StatusCode = opcuaJsonEncodeStatusCode104(dataValue.statusCode, JsonEncoderMode104.NonReversible);
                break;
            case JsonEncodingScheme.DeprecatedReversible:
                pojo.StatusCode = opcuaJsonEncodeStatusCode104(dataValue.statusCode, JsonEncoderMode104.Reversible);
                break;
            case JsonEncodingScheme.Verbose:
                pojo.StatusCode = opcuaJsonEncodeStatusCode105(dataValue.statusCode, JsonEncoderMode105.Verbose);
                break;
            case JsonEncodingScheme.Compact:
                pojo.StatusCode = opcuaJsonEncodeStatusCode105(dataValue.statusCode, JsonEncoderMode105.Compact);
                break;
            default:
                throw new Error("Invalid JsonEncodingScheme");
        }
    }
}
function _decodeTimestampsAndStatusCodeJson(pojo: DataValueStatusAndTimestamps, dataValueOpt: DataValueOptions) {
    if (pojo.ServerPicoseconds) {
        dataValueOpt.serverPicoseconds = pojo.ServerPicoseconds;
    }
    if (pojo.SourcePicoseconds) {
        dataValueOpt.sourcePicoseconds = pojo.SourcePicoseconds;
    }
    if (pojo.ServerTimestamp) {
        dataValueOpt.serverTimestamp = new Date(pojo.ServerTimestamp);
    }
    if (pojo.SourceTimestamp) {
        dataValueOpt.sourceTimestamp = new Date(pojo.SourceTimestamp);
    }
    if (pojo.StatusCode) {
        dataValueOpt.statusCode = opcuaJsonDecodeStatusCode(pojo.StatusCode);
    }
}

/**
 *
 * @param dataValue
 * @param mask
 * @returns
 */
export function opcuaJsonEncodeDataValueMQTT(
    dataValue: DataValue,
    encoding: JsonEncodingScheme,
    mask: DataSetFieldContentMask,
    namespaceArray: string[] = []
): VariantJSONBody | VariantJSON105 | VariantJSON104 | DataValueJSON105 | DataValueJSON104 | null {
    switch (encoding) {
        case JsonEncodingScheme.DeprecatedNonReversible:
            return _opcuaJsonEncodeDataValueMQTT104(dataValue, JsonEncoderMode104.NonReversible, mask, namespaceArray);
        case JsonEncodingScheme.DeprecatedReversible:
            return _opcuaJsonEncodeDataValueMQTT104(dataValue, JsonEncoderMode104.Reversible, mask, namespaceArray);
        case JsonEncodingScheme.Verbose:
            return _opcuaJsonEncodeDataValueMQTT105(dataValue, JsonEncoderMode105.Verbose, mask, namespaceArray);
        case JsonEncodingScheme.Compact: {
            return _opcuaJsonEncodeDataValueMQTT105(dataValue, JsonEncoderMode105.Compact, mask, namespaceArray);
        }
        default:
            throw new Error("Invalid JsonEncodingScheme");
    }
}
function _opcuaJsonEncodeDataValueMQTT104(
    dataValue: DataValue,
    mode: JsonEncoderMode104,
    mask: DataSetFieldContentMask,
    namespaceArray: string[] = []
): VariantJSONBody | VariantJSON104 | DataValueJSON104 | null {
    /**
     * All fields with a concrete DataType are encoded using VerboseEncoding if FieldEncoding1 is
     * FALSE and CompactEncoding if FieldEncoding1 is TRUE.
     *
     * See the OPC UA JSON Data encodings defined in OPC 10000-6.
     *
     * The fields in the DataSetMessage are specified by the DataSetFieldContentMask in the
     * DataSetWriter parameters.
     *
     * The format of the field values in the Payload depend on the setting of
     * DataSetFieldContentMask, the FieldEncoding1 and the FieldEncoding2 flag in
     * DataSetMessageContentMask. The resulting JSON encoding is defined in Table 111.
     *
     * FieldEncoding1    FieldEncoding2  Description
     * False             True            The JSON VerboseEncoding is used for the DataSetMessage field encoding.
     * True              True            The JSON CompactEncoding is used for the DataSetMessage field encoding.
     * False             False           The deprecated JSON NonReversibleEncoding is used for the
     *                                   DataSetMessage field encoding.
     *                                   The RawData bit of the DataSetFieldContentMask shall be ignored.
     * True              False           The deprecated JSON ReversibleFieldEncoding is used for the
     *                                   DataSetMessage field encoding.
     *                                   The RawData bit of the DataSetFieldContentMask shall be ignored.
     *
     * If the DataSetFieldContentMask is 0x0 or 0x20 (only the RawData flag is set), the
     * DataSetMessage fields are encoded as Variant. Otherwise the fields are encoded as
     * DataValue.
     * If the KeyFrameCount is 0, the DataSetFieldContentMask shall be 0x0 or 0x20.
     *
     * If the FieldEncoding1 is FALSE in the DataSetMessageContentMask, the Variant at the top
     * level of a field is encoded as a JSON value containing only the value of the Body field.
     *
     * If this Variant contains an ExtensionObject, the ExtensionObject shall be encoded as a Structure
     * without the UaTypeId field.
     * This also applies to the Variant in a DataValue at the top level of a field.
     *
     * If the RawData flag is set, the UaType fields of Variants and the UaTypeId fields of
     * ExtensionObjects are always omitted.
     *
     * If the RawData flag ist set, it is not possible to reverse the data in a DataSetReader in the
     * following cases.
     *
     *  * DataSet fields have an abstract DataType in the DataSetMetaData.
     *  * DataSet field values do not match the DataType specified in the DataSetMetaData if
     *    they are Structure DataTypes
     **/
    if (mask === DataSetFieldContentMask.None) {
        return opcuaJsonEncodeVariant104(dataValue.value, mode, namespaceArray);
    }
    const pojoVariant = opcuaJsonEncodeVariant104(dataValue.value, mode, namespaceArray);
    if (mask & DataSetFieldContentMask.RawData) {
        // RawData: the field value is a Variant encoded using the non-reversible OPC UA JSON Data Encoding defined in OPC 10000-6.
        return pojoVariant;
    }

    /**
     * DataValue values shall be encoded as a JSON object with the fields below.
     * JSON Object Definition for a DataValue
     * Name 	            DataType	  Description
     * Value	            Variant	    The value.
     * Status	            StatusCode	The status associated with the value.
     * SourceTimestamp	  DateTime	  The source timestamp associated with the value.
     * SourcePicoSeconds	UInt16	    The number of 10 picosecond intervals for the SourceTimestamp.
     * ServerTimestamp	  DateTime	  The Server timestamp associated with the value.
     * ServerPicoSeconds	UInt16	    The number of 10 picosecond intervals for the ServerTimestamp.
     *
     * If a field has a null or default value it is omitted. Each field is encoded using the rules
     * defined for the built-in type specified in the Data Type column.
     */
    const pojo: DataValueJSON104 = {
        Value: pojoVariant as VariantJSON104
    };
    _setTimestampsAndStatusCode(pojo, dataValue, mask, toJsonEncodingScheme(mode));

    return pojo;
}

/**
 *
 * @param dataValue
 * @param mask
 * @returns
 */
export function _opcuaJsonEncodeDataValueMQTT105(
    dataValue: DataValue,
    mode: JsonEncoderMode105,
    mask: DataSetFieldContentMask,
    namespaceArray: string[] = []
): VariantJSONBody | DataValueJSON105 | null {
    if (mask === DataSetFieldContentMask.None) {
        if (mode === JsonEncoderMode105.Verbose) {
            return opcuaJsonEncodeVariant105(dataValue.value, mode, namespaceArray);
        } else {
            return opcuaJsonEncodeVariant105(dataValue.value, mode, namespaceArray);
        }
    }

    const pojoVariant = opcuaJsonEncodeVariant105(dataValue.value, mode, namespaceArray) as VariantJSON105 | VariantJSONBody;
    if (mask & DataSetFieldContentMask.RawData) {
        // RawData: the field value is a Variant encoded using the non-reversible OPC UA JSON Data Encoding defined in OPC 10000-6.
        return pojoVariant;
    }
    const pojo: DataValueJSON105 = pojoVariant as DataValueJSON105;
    _setTimestampsAndStatusCode(pojo, dataValue, mask, toJsonEncodingScheme(mode));
    return pojo;
}

const DataSetFieldContentMaskAll =
    DataSetFieldContentMask.StatusCode |
    DataSetFieldContentMask.SourceTimestamp |
    DataSetFieldContentMask.SourcePicoSeconds |
    DataSetFieldContentMask.ServerTimestamp |
    DataSetFieldContentMask.ServerPicoSeconds;

export function opcuaJsonEncodeDataValue104(
    dataValue: DataValue,
    mode: JsonEncoderMode104,
    namespaceArray: string[]
): DataValueJSON104 {
    const pojoVariant = opcuaJsonEncodeVariant104(dataValue.value, mode, namespaceArray);
    if (mode === JsonEncoderMode104.Reversible) {
        const pojo: DataValueJSON104 = {
            Value: pojoVariant as VariantJSON104
        };
        _setTimestampsAndStatusCode(pojo, dataValue, DataSetFieldContentMaskAll, toJsonEncodingScheme(mode));
        return pojo;
    }
    const pojo: DataValueJSON104 = {
        Value: pojoVariant as VariantJSON104
    };
    _setTimestampsAndStatusCode(pojo, dataValue, DataSetFieldContentMaskAll, toJsonEncodingScheme(mode));
    return pojo;
}
export function opcuaJsonEncodeDataValue105(
    dataValue: DataValue,
    mode: JsonEncoderMode105,
    namespaceArray: string[]
): DataValueJSON105 {
    if (mode === JsonEncoderMode105.Verbose) {
        const pojoVariant = opcuaJsonEncodeVariant105(dataValue.value, mode, namespaceArray);
        const pojo: DataValueJSON105 = pojoVariant as DataValueJSON105;
        _setTimestampsAndStatusCode(pojo, dataValue, DataSetFieldContentMaskAll, toJsonEncodingScheme(mode));
        return pojo;
    } else {
        const pojoVariant = opcuaJsonEncodeVariant105(dataValue.value, mode, namespaceArray);
        const pojo: DataValueJSON105 = pojoVariant as DataValueJSON105;
        _setTimestampsAndStatusCode(pojo, dataValue, DataSetFieldContentMaskAll, toJsonEncodingScheme(mode));
        return pojo;
    }
}

export function opcuaJsonEncodeDataValue(
    dataValue: DataValue,
    mode: JsonEncodingScheme.Compact | JsonEncodingScheme.Verbose,
    namespaceArray: string[]
): DataValueJSON105;
export function opcuaJsonEncodeDataValue(
    dataValue: DataValue,
    mode: JsonEncodingScheme.DeprecatedNonReversible | JsonEncodingScheme.DeprecatedReversible,
    namespaceArray: string[]
): DataValueJSON104;
export function opcuaJsonEncodeDataValue(
    dataValue: DataValue,
    mode: JsonEncodingScheme,
    namespaceArray: string[]
): DataValueJSON105 | DataValueJSON104 {
    switch (mode) {
        case JsonEncodingScheme.DeprecatedNonReversible:
            return opcuaJsonEncodeDataValue104(dataValue, JsonEncoderMode104.NonReversible, namespaceArray);
        case JsonEncodingScheme.DeprecatedReversible:
            return opcuaJsonEncodeDataValue104(dataValue, JsonEncoderMode104.Reversible, namespaceArray);
        case JsonEncodingScheme.Verbose:
            return opcuaJsonEncodeDataValue105(dataValue, JsonEncoderMode105.Verbose, namespaceArray);
        case JsonEncodingScheme.Compact:
            return opcuaJsonEncodeDataValue105(dataValue, JsonEncoderMode105.Compact, namespaceArray);
        default:
            throw new Error("Invalid JsonEncodingScheme");
    }
}

export function opcuaJsonDecodeDataValue104(
    pojo: DataValueJSON104 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): DataValue {
    if (!pojo) {
        return new DataValue({ value: { dataType: DataType.Null } });
    }
    const dataValueOpt: DataValueOptions = {};
    _decodeTimestampsAndStatusCodeJson(pojo, dataValueOpt);
    if (pojo.Value) {
        dataValueOpt.value = opcuaJsonDecodeVariant104(pojo.Value, builder, namespaceArray);
    }
    return new DataValue(dataValueOpt);
}

export function opcuaJsonDecodeDataValue105(
    pojo: DataValueJSON105 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): DataValue {
    if (!pojo) {
        return new DataValue({ value: { dataType: DataType.Null } });
    }
    const dataValueOpt: DataValueOptions = {};
    _decodeTimestampsAndStatusCodeJson(pojo, dataValueOpt);
    if (pojo.Value) {
        dataValueOpt.value = opcuaJsonDecodeVariant105(pojo, builder, namespaceArray);
    }
    return new DataValue(dataValueOpt);
}

export function opcuaJsonDecodeDataValue(
    pojo: DataValueJSON104 | DataValueJSON105 | null | undefined,
    builder: ExtensionObjectBuilder,
    namespaceArray: string[]
): DataValue {
    if (!pojo) {
        return new DataValue({ value: { dataType: DataType.Null } });
    }
    if ("UaType" in pojo) {
        return opcuaJsonDecodeDataValue105(pojo as DataValueJSON105, builder, namespaceArray);
    }
    return opcuaJsonDecodeDataValue104(pojo as DataValueJSON104, builder, namespaceArray);
}
