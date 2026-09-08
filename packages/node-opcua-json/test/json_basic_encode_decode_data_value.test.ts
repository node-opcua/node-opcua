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

import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataSetFieldContentMask } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import {
    type DataValueJSON104,
    type DataValueJSON105,
    opcuaJsonDecodeDataValue,
    opcuaJsonEncodeDataValueMQTT
} from "../source/index.js";
import { opcuaJsonEncodeDataValue104, opcuaJsonEncodeDataValue105 } from "../source/json_basic_encoding_decoding_data_value.js";
import { JsonEncoderMode104, JsonEncoderMode105, JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

const namespaceArray: string[] = [];

describe("JSON encode DataValue", () => {
    it("opcuaJsonEncodeDataValue104 - reversible - should encode a DataValue - StatusCodes.GoodWithOverflowBit", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodWithOverflowBit,
            value: { value: 1, dataType: DataType.UInt16 }
        });
        const pojo = opcuaJsonEncodeDataValue104(dataValue, JsonEncoderMode104.Reversible, namespaceArray);
        // console.log(pojo);
        should(pojo).eql({
            StatusCode: 1152,
            Value: {
                Body: 1,
                Type: 5
            }
        });
    });

    it("opcuaJsonEncodeDataValue104 - non-reversible - should encode a DataValue - StatusCodes.GoodWithOverflowBit", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodWithOverflowBit,
            value: { value: 1, dataType: DataType.UInt16 }
        });
        const pojo = opcuaJsonEncodeDataValue104(dataValue, JsonEncoderMode104.NonReversible, namespaceArray);
        // console.log(pojo);
        should(pojo).eql({
            StatusCode: {
                Code: 1152,
                Symbol: "Good"
            },
            Value: 1
        });
    });

    // https://github.com/OPCFoundation/UA-Nodeset/blob/UA-1.05.04-2025-01-08/Schema/opc.ua.jsonschema.verbose.json

    it("opcuaJsonEncodeDataValue105 - Verbose - should encode a DataValue - StatusCodes.GoodWithOverflowBit", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodWithOverflowBit,
            value: { value: 1, dataType: DataType.UInt16 }
        });
        const pojo = opcuaJsonEncodeDataValue105(dataValue, JsonEncoderMode105.Verbose, namespaceArray);
        // console.log(pojo);
        should(pojo).eql({
            StatusCode: {
                Code: 1152,
                Symbol: "Good"
            },
            Value: 1,
            UaType: 5
        });
    });

    it("opcuaJsonEncodeDataValue105 - Compact - should encode a DataValue - StatusCodes.GoodWithOverflowBit", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodWithOverflowBit,
            value: { value: 1, dataType: DataType.UInt16 }
        });
        const pojo = opcuaJsonEncodeDataValue105(dataValue, JsonEncoderMode105.Compact, namespaceArray);
        // console.log(pojo);
        should(pojo).eql({
            StatusCode: {
                Code: 1152
                // Symbol: "Good", no Symbol in CompactEncoding
            },
            Value: 1,
            UaType: 5
        });
    });
});

describe("JSON encode DataValueMQTT", () => {
    it("should encode a DataValue - StatusCodes.Good", () => {
        const dataValue = new DataValue({ statusCode: StatusCodes.Good });
        const pojo = opcuaJsonEncodeDataValueMQTT(dataValue, JsonEncodingScheme.Compact, DataSetFieldContentMask.StatusCode);
        // console.log(pojo);
        // The DataValue structure field StatusCode is included in the DataSetMessages.
        // If this flag is set, the fields are represented as DataValue.

        // However the StatusCode is not encoded in CompactEncoding if its value is Good.

        should(pojo).eql({ UaType: 0 }); //
    });
    it("should encode a DataValue - CompactEncoding -  StatusCodes.GoodCascadeNotInvited", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodCascadeNotInvited
        });
        const pojo = opcuaJsonEncodeDataValueMQTT(dataValue, JsonEncodingScheme.Compact, DataSetFieldContentMask.StatusCode);
        // console.log(pojo);
        // The DataValue structure field StatusCode is included in the DataSetMessages.
        // If this flag is set, the fields are represented as DataValue.
        should(pojo).eql({ UaType: 0, StatusCode: { Code: 67305472 } }); //
    });

    it("should encode a DataValue - DeprecatedReversibleEncoding -  StatusCodes.GoodCascadeNotInvited", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodCascadeNotInvited
        });
        const pojo = opcuaJsonEncodeDataValueMQTT(
            dataValue,
            JsonEncodingScheme.DeprecatedReversible,
            DataSetFieldContentMask.StatusCode
        );
        // console.log(pojo);
        // The DataValue structure field StatusCode is included in the DataSetMessages.
        // If this flag is set, the fields are represented as DataValue.
        should(pojo).eql({
            Value: null,
            StatusCode: 67305472
        }); //
    });

    it("should encode a DataValue - StatusCodes.Bad", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.BadUnknownResponse
        });
        const pojo = opcuaJsonEncodeDataValueMQTT(dataValue, JsonEncodingScheme.Compact, DataSetFieldContentMask.StatusCode);
        // console.log(pojo);
        should(pojo).eql({
            StatusCode: {
                Code: 2148073472
                // Symbol: "BadUnknownResponse", // Symbol not encoded in CompactEncoding
            },
            UaType: 0
        });
    });

    it("should encode a DataValue - Raw", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodDependentValueChanged,
            value: {
                dataType: "Double",
                value: 3.14
            }
        });
        const pojo = opcuaJsonEncodeDataValueMQTT(
            dataValue,
            JsonEncodingScheme.DeprecatedNonReversible,
            DataSetFieldContentMask.RawData
        );
        // console.log(pojo);
        should(pojo).eql(3.14);
    });

    it("should encode a DataValue - Reversible - DataSetFieldContentMask.None", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodDependentValueChanged,
            value: {
                dataType: "Double",
                value: 3.14
            }
        });
        const pojo = opcuaJsonEncodeDataValueMQTT(dataValue, JsonEncodingScheme.Compact, DataSetFieldContentMask.None);
        // console.log(pojo);
        should(pojo).eql({
            UaType: 11,
            Value: 3.14
        });
    });
});

describe("JSON decode DataValue", () => {
    it("should decode a DataValue that was in 104 format", () => {
        const pojo: DataValueJSON104 = {
            Value: {
                Body: 3.14,
                Type: 11
            },
            StatusCode: {
                Code: StatusCodes.GoodDependentValueChanged.value,
                Symbol: "GoodDependentValueChanged"
            },
            ServerPicoseconds: 100,
            ServerTimestamp: new Date("1789-06-14T12:00:00.000Z"),
            SourcePicoseconds: 200,
            SourceTimestamp: new Date("1789-06-14T12:00:00.000Z")
        };

        const dataValue = opcuaJsonDecodeDataValue(pojo, fakeBuilder, namespaceArray);
        dataValue.statusCode.should.eql(StatusCodes.GoodDependentValueChanged);
        dataValue.serverPicoseconds.should.eql(100);
        dataValue.sourcePicoseconds.should.eql(200);
    });
    it("should decode a DataValue that was in 105 format", () => {
        const pojo: DataValueJSON105 = {
            Value: 3.14,
            UaType: 11,
            StatusCode: {
                Code: StatusCodes.GoodDependentValueChanged.value,
                Symbol: "GoodDependentValueChanged"
            },
            ServerPicoseconds: 100,
            ServerTimestamp: new Date("1789-06-14T12:00:00.000Z"),
            SourcePicoseconds: 200,
            SourceTimestamp: new Date("1789-06-14T12:00:00.000Z")
        };

        const dataValue = opcuaJsonDecodeDataValue(pojo, fakeBuilder, namespaceArray);
        dataValue.statusCode.should.eql(StatusCodes.GoodDependentValueChanged);
        dataValue.serverPicoseconds.should.eql(100);
        dataValue.sourcePicoseconds.should.eql(200);
    });
});
