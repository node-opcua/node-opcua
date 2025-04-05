/**
 * @module node-opcua-data-value
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { coerceDateTime, getCurrentClock, PreciseClock } from "node-opcua-date-time";
import {
    BaseUAObject,
    buildStructuredType,
    check_options_correctness_against_schema,
    DecodeDebugOptions,
    initialize_field,
    parameters,
    registerSpecialVariantEncoder,
    IStructuredTypeSchema,
    FieldCategory
} from "node-opcua-factory";
import { coerceStatusCode, StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, sameVariant, Variant, VariantArrayType, VariantOptions, VariantOptionsT, VariantT } from "node-opcua-variant";
import {
    DateTime,
    decodeHighAccuracyDateTime,
    decodeStatusCode,
    decodeUInt16,
    decodeUInt8,
    encodeHighAccuracyDateTime,
    encodeStatusCode,
    encodeUInt16,
    encodeUInt8,
    UInt16
} from "node-opcua-basic-types";
import { make_errorLog } from "node-opcua-debug";
import { AttributeIds } from "node-opcua-data-model";
import { DataValueEncodingByte } from "./DataValueEncodingByte_enum";
import { TimestampsToReturn } from "./TimestampsToReturn_enum";

const errorLog = make_errorLog(__filename);

type NumericalRange = any;

// tslint:disable:no-bitwise
function getDataValue_EncodingByte(dataValue: DataValue): DataValueEncodingByte {
    let encodingMask = 0;
    if (dataValue.value && dataValue.value.dataType !== DataType.Null) {
        encodingMask |= DataValueEncodingByte.Value;
    }
    //  if (dataValue.statusCode !== null ) {
    if (dataValue.statusCode !== null && typeof dataValue.statusCode === "object" && dataValue.statusCode.value !== 0) {
        encodingMask |= DataValueEncodingByte.StatusCode;
    }
    if (dataValue.sourceTimestamp && (dataValue.sourceTimestamp as any) !== "null") {
        encodingMask |= DataValueEncodingByte.SourceTimestamp;
    }
    // the number of picoseconds that can be encoded are
    // 100 nano * 10000;
    // above this the value contains the excess in pico second to make the sourceTimestamp more accurate
    if (dataValue.sourcePicoseconds ? dataValue.sourcePicoseconds % 100000 : false) {
        encodingMask |= DataValueEncodingByte.SourcePicoseconds;
    }
    if (dataValue.serverTimestamp && (dataValue.serverTimestamp as any) !== "null") {
        encodingMask |= DataValueEncodingByte.ServerTimestamp;
    }
    if (dataValue.serverPicoseconds ? dataValue.serverPicoseconds % 100000 : false) {
        encodingMask |= DataValueEncodingByte.ServerPicoseconds;
    }
    return encodingMask;
}

/**
 * @internal
 * @param dataValue 
 * @param stream 
 */
export function encodeDataValue(dataValue: DataValue, stream: OutputBinaryStream): void {
    const encodingMask = getDataValue_EncodingByte(dataValue);
    assert(isFinite(encodingMask) && encodingMask >= 0 && encodingMask <= 0x3f);
    // write encoding byte
    encodeUInt8(encodingMask, stream);

    // write value as Variant
    if (encodingMask & DataValueEncodingByte.Value) {
        if (!dataValue.value) {
            dataValue.value = new Variant();
        }
        // istanbul ignore next
        if (!dataValue.value.encode) {
            errorLog(" CANNOT FIND ENCODE METHOD ON VARIANT !!! HELP", JSON.stringify(dataValue, null, " "));
        }
        dataValue.value.encode(stream);
    }
    // write statusCode
    if (encodingMask & DataValueEncodingByte.StatusCode) {
        encodeStatusCode(dataValue.statusCode, stream);
    }
    // write sourceTimestamp
    if (encodingMask & DataValueEncodingByte.SourceTimestamp && dataValue.sourceTimestamp !== null) {
        encodeHighAccuracyDateTime(dataValue.sourceTimestamp, dataValue.sourcePicoseconds, stream);
    }
    // write sourcePicoseconds
    if (encodingMask & DataValueEncodingByte.SourcePicoseconds) {
        assert(dataValue.sourcePicoseconds !== null);
        const sourcePicoseconds = Math.floor((dataValue.sourcePicoseconds % 100000) / 10);
        encodeUInt16(sourcePicoseconds, stream);
    }
    // write serverTimestamp
    if (encodingMask & DataValueEncodingByte.ServerTimestamp && dataValue.serverTimestamp !== null) {
        encodeHighAccuracyDateTime(dataValue.serverTimestamp, dataValue.serverPicoseconds, stream);
    }
    // write serverPicoseconds
    if (encodingMask & DataValueEncodingByte.ServerPicoseconds) {
        assert(dataValue.serverPicoseconds !== null);
        const serverPicoseconds = Math.floor((dataValue.serverPicoseconds % 100000) / 10); // we encode 10-picoseconds
        encodeUInt16(serverPicoseconds, stream);
    }
}

function decodeDebugDataValue(dataValue: DataValue, stream: BinaryStream, options: DecodeDebugOptions) {
    const tracer = options.tracer;

    let cur = stream.length;
    const encodingMask = decodeUInt8(stream);
    assert(encodingMask <= 0x3f);

    tracer.trace("member", "encodingByte", "0x" + encodingMask.toString(16), cur, stream.length, "Mask");
    tracer.encoding_byte(encodingMask, DataValueEncodingByte, cur, stream.length);

    if (encodingMask & DataValueEncodingByte.Value) {
        dataValue.value = new Variant();
        dataValue.value.decodeDebug(stream, options);
    }
    // read statusCode
    cur = stream.length;
    if (encodingMask & DataValueEncodingByte.StatusCode) {
        dataValue.statusCode = decodeStatusCode(stream);
        tracer.trace("member", "statusCode", dataValue.statusCode, cur, stream.length, "StatusCode");
    }
    // read sourceTimestamp
    cur = stream.length;
    if (encodingMask & DataValueEncodingByte.SourceTimestamp) {
        const [d, picoseconds] = decodeHighAccuracyDateTime(stream);
        dataValue.sourceTimestamp = d;
        dataValue.sourcePicoseconds = picoseconds | 0;
        tracer.trace("member", "sourceTimestamp", dataValue.sourceTimestamp, cur, stream.length, "DateTime");
    }
    // read sourcePicoseconds
    cur = stream.length;
    dataValue.sourcePicoseconds = 0;
    if (encodingMask & DataValueEncodingByte.SourcePicoseconds) {
        const tenPico = decodeUInt16(stream);
        dataValue.sourcePicoseconds += tenPico * 10;
        tracer.trace("member", "sourcePicoseconds", dataValue.sourcePicoseconds, cur, stream.length, "UInt16");
    }
    // read serverTimestamp
    cur = stream.length;
    dataValue.serverPicoseconds = 0;
    if (encodingMask & DataValueEncodingByte.ServerTimestamp) {
        const [d, picoseconds] = decodeHighAccuracyDateTime(stream);
        dataValue.serverTimestamp = d;
        dataValue.serverPicoseconds = picoseconds | 0;
        tracer.trace("member", "serverTimestamp", dataValue.serverTimestamp, cur, stream.length, "DateTime");
    }
    // read serverPicoseconds
    cur = stream.length;
    if (encodingMask & DataValueEncodingByte.ServerPicoseconds) {
        const tenPico = decodeUInt16(stream);
        dataValue.serverPicoseconds += tenPico * 10;
        tracer.trace("member", "serverPicoseconds", dataValue.serverPicoseconds, cur, stream.length, "UInt16");
    }
}

function decodeDataValueInternal(dataValue: DataValue, stream: BinaryStream) {
    const encodingMask = decodeUInt8(stream);
    if (encodingMask & DataValueEncodingByte.Value) {
        dataValue.value = new Variant();
        dataValue.value.decode(stream);
    }
    // read statusCode
    if (encodingMask & DataValueEncodingByte.StatusCode) {
        dataValue.statusCode = decodeStatusCode(stream);
    } else {
        dataValue.statusCode = StatusCodes.Good;
    }

    dataValue.sourcePicoseconds = 0;
    // read sourceTimestamp
    if (encodingMask & DataValueEncodingByte.SourceTimestamp) {
        const [d, picoseconds] = decodeHighAccuracyDateTime(stream);
        dataValue.sourceTimestamp = d
        dataValue.sourcePicoseconds += picoseconds | 0;
    }
    // read sourcePicoseconds
    if (encodingMask & DataValueEncodingByte.SourcePicoseconds) {
        dataValue.sourcePicoseconds += decodeUInt16(stream) * 10;
    }
    // read serverTimestamp
    dataValue.serverPicoseconds = 0;
    if (encodingMask & DataValueEncodingByte.ServerTimestamp) {
        const [d, picoseconds] = decodeHighAccuracyDateTime(stream);
        dataValue.serverTimestamp = d;
        dataValue.serverPicoseconds += picoseconds | 0;
    }
    // read serverPicoseconds
    if (encodingMask & DataValueEncodingByte.ServerPicoseconds) {
        dataValue.serverPicoseconds += decodeUInt16(stream) * 10;
    }
}

export function decodeDataValue(stream: BinaryStream, dataValue?: DataValue): DataValue {
    dataValue = dataValue || new DataValue();
    decodeDataValueInternal(dataValue, stream);
    return dataValue;
}

function isValidDataValue(self: DataValue): boolean {
    if (self.value !== null && typeof self.value === "object") {
        assert(self.value);
        return self.value.isValid();
    } else {
        assert(!self.value);
        // in this case StatusCode shall not be Good
        assert(self.statusCode.isNotGood());
    }
    return true;
}

// OPC-UA part 4 -  $7.7
const schemaDataValue: IStructuredTypeSchema = buildStructuredType({
    baseType: "BaseUAObject",
    name: "DataValue",
    category: FieldCategory.basic,
    fields: [
        { name: "Value", fieldType: "Variant", defaultValue: null },
        { name: "StatusCode", fieldType: "StatusCode", defaultValue: StatusCodes.Good },
        { name: "SourceTimestamp", fieldType: "DateTime", defaultValue: null },
        { name: "SourcePicoseconds", fieldType: "UInt16", defaultValue: 0 },
        { name: "ServerTimestamp", fieldType: "DateTime", defaultValue: null },
        { name: "ServerPicoseconds", fieldType: "UInt16", defaultValue: 0 }
    ]
});

export interface DataValueOptions {
    value?: VariantOptions;
    statusCode?: StatusCode;
    sourceTimestamp?: DateTime;
    sourcePicoseconds?: UInt16;
    serverTimestamp?: DateTime;
    serverPicoseconds?: UInt16;
}

function toMicroNanoPico(picoseconds: number): string {
    return "" + w((picoseconds / 1000000) >> 0) + "." + w(((picoseconds % 1000000) / 1000) >> 0) + "." + w(picoseconds % 1000 >> 0);
    //    + " (" + picoseconds+ ")";
}
function d(timestamp: Date | null, picoseconds: number): string {
    return timestamp ? timestamp.toISOString() + " $ " + toMicroNanoPico(picoseconds) : "null"; // + "  " + (this.serverTimestamp ? this.serverTimestamp.getTime() :"-");
}
const emptyObject = {};

export class DataValue extends BaseUAObject {
    /**
     * @internal
     */
    public static possibleFields: string[] = [
        "value",
        "statusCode",
        "sourceTimestamp",
        "sourcePicoseconds",
        "serverTimestamp",
        "serverPicoseconds"
    ];
    /**
     * @internal
     */
    public static schema = schemaDataValue;
    public value: Variant;
    public statusCode: StatusCode;
    public sourceTimestamp: DateTime;
    public sourcePicoseconds: UInt16;
    public serverTimestamp: DateTime;
    public serverPicoseconds: UInt16;

    /**
     *
     */
    constructor(options?: DataValueOptions | null) {
        super();
        if (options === null) {
            this.statusCode = StatusCodes.Bad;
            this.sourceTimestamp = null;
            this.sourcePicoseconds = 0;
            this.serverTimestamp = null;
            this.serverPicoseconds = 0;
            this.value = new Variant(null);
            return;
        }
        options = options || emptyObject;
        /* istanbul ignore next */
        if (parameters.debugSchemaHelper) {
            const schema = schemaDataValue;
            check_options_correctness_against_schema(this, schema, options);
        }
        if (options.value === undefined || options.value === null) {
            this.value = new Variant({ dataType: DataType.Null });
        } else {
            this.value = options.value ? new Variant(options.value) : new Variant({ dataType: DataType.Null });
        }
        this.statusCode = coerceStatusCode(options.statusCode || StatusCodes.Good);
        this.sourceTimestamp = options.sourceTimestamp ? coerceDateTime(options.sourceTimestamp) : null;
        this.sourcePicoseconds = options.sourcePicoseconds || 0;
        this.serverTimestamp = options.serverTimestamp ? coerceDateTime(options.serverTimestamp) : null;
        this.serverPicoseconds = options.serverPicoseconds || 0;
    }

    public encode(stream: OutputBinaryStream): void {
        encodeDataValue(this, stream);
    }

    public decode(stream: BinaryStream): void {
        decodeDataValueInternal(this, stream);
    }

    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {
        decodeDebugDataValue(this, stream, options);
    }

    public isValid(): boolean {
        return isValidDataValue(this);
    }

    public toString(): string {
        let str = "{ /* DataValue */";
        if (this.value) {
            str += "\n" + "   value: " + Variant.prototype.toString.apply(this.value); // this.value.toString();
        } else {
            str += "\n" + "   value:            <null>";
        }
        str += "\n" + "   statusCode:      " + (this.statusCode ? this.statusCode.toString() : "null");
        str += "\n" + "   serverTimestamp: " + d(this.serverTimestamp, this.serverPicoseconds);
        str += "\n" + "   sourceTimestamp: " + d(this.sourceTimestamp, this.sourcePicoseconds);
        str += "\n" + "}";
        return str;
    }

    public clone(): DataValue {
        return new DataValue({
            serverPicoseconds: this.serverPicoseconds,
            serverTimestamp: this.serverTimestamp,
            sourcePicoseconds: this.sourcePicoseconds,
            sourceTimestamp: this.sourceTimestamp,
            statusCode: this.statusCode,
            value: this.value ? this.value.clone() : undefined
        });
    }
}

DataValue.prototype.schema = DataValue.schema;
registerSpecialVariantEncoder(DataValue);

export type DataValueLike = DataValueOptions | DataValue;

function w(n: number): string {
    return n.toString().padStart(3, "0");
}

function _partial_clone(dataValue: DataValue): DataValue {
    const cloneDataValue = new DataValue({ value: undefined });
    cloneDataValue.value = dataValue.value;
    cloneDataValue.statusCode = dataValue.statusCode;
    return cloneDataValue;
}

/**
 * apply the provided timestampsToReturn flag to the dataValue and return a cloned dataValue
 * with the specified timestamps.
 * @param dataValue 
 * @param timestampsToReturn 
 * @param attributeId 
 * @returns 
 */
export function apply_timestamps(
    dataValue: DataValue,
    timestampsToReturn: TimestampsToReturn,
    attributeId: AttributeIds
): DataValue {
    let cloneDataValue: DataValue | null = null;
    let now: PreciseClock | null = null;
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            break;
        case TimestampsToReturn.Server:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (!cloneDataValue.serverTimestamp) {
                now = now || getCurrentClock();
                cloneDataValue.serverTimestamp = now.timestamp as DateTime;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            }
            break;
        case TimestampsToReturn.Source:
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
        default:
            assert(timestampsToReturn === TimestampsToReturn.Both);
            cloneDataValue = cloneDataValue || _partial_clone(dataValue);
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            if (!dataValue.serverTimestamp) {
                now = now || getCurrentClock();
                cloneDataValue.serverTimestamp = now.timestamp as DateTime;
                cloneDataValue.serverPicoseconds = now.picoseconds;
            }
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== AttributeIds.Value) {
        cloneDataValue.sourceTimestamp = null;
    }
    return cloneDataValue;
}

/**
 * 
 * @param dataValue a DataValue
 * @param timestampsToReturn  a TimestampsToReturn flag to determine which timestamp should be kept
 * @param attributeId if attributeId is not Value, sourceTimestamp will forcefully be set to null
 * @param now an optional current clock to be used to set the serverTimestamp
 * @returns 
 */
export function apply_timestamps_no_copy(
    dataValue: DataValue,
    timestampsToReturn: TimestampsToReturn,
    attributeId: AttributeIds,
    now?: PreciseClock
): DataValue {
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            dataValue.sourceTimestamp = null;
            dataValue.sourcePicoseconds = 0;
            dataValue.serverTimestamp = null;
            dataValue.serverPicoseconds = 0;
            break;
        case TimestampsToReturn.Server:
            dataValue.sourceTimestamp = null;
            dataValue.sourcePicoseconds = 0;
            if (!dataValue.serverTimestamp) {
                now = now || getCurrentClock();
                dataValue.serverTimestamp = now.timestamp as DateTime;
                dataValue.serverPicoseconds = now.picoseconds;
            }
            break;
        case TimestampsToReturn.Source:
            break;
        case TimestampsToReturn.Both:
        default:
            assert(timestampsToReturn === TimestampsToReturn.Both);
            if (!dataValue.serverTimestamp) {
                now = now || getCurrentClock();
                dataValue.serverTimestamp = now.timestamp as DateTime;
                dataValue.serverPicoseconds = now.picoseconds;
            }
            break;
    }
    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== AttributeIds.Value) {
        dataValue.sourceTimestamp = null;
    }
    return dataValue;
}

/**
 * @deprecated
 */
function apply_timestamps2(dataValue: DataValue, timestampsToReturn: TimestampsToReturn, attributeId: AttributeIds): DataValue {
    assert(attributeId > 0);
    assert(Object.prototype.hasOwnProperty.call(dataValue, "serverTimestamp"));
    assert(Object.prototype.hasOwnProperty.call(dataValue, "sourceTimestamp"));
    const cloneDataValue = new DataValue({});
    cloneDataValue.value = dataValue.value;
    cloneDataValue.statusCode = dataValue.statusCode;
    const now = getCurrentClock();
    // apply timestamps
    switch (timestampsToReturn) {
        case TimestampsToReturn.Server:
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            cloneDataValue.serverTimestamp = now.timestamp as DateTime;
            cloneDataValue.serverPicoseconds = now.picoseconds;
            break;
        case TimestampsToReturn.Source:
            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
        case TimestampsToReturn.Both:
            cloneDataValue.serverTimestamp = dataValue.serverTimestamp;
            cloneDataValue.serverPicoseconds = dataValue.serverPicoseconds;
            cloneDataValue.serverTimestamp = now.timestamp as DateTime;
            cloneDataValue.serverPicoseconds = now.picoseconds;

            cloneDataValue.sourceTimestamp = dataValue.sourceTimestamp;
            cloneDataValue.sourcePicoseconds = dataValue.sourcePicoseconds;
            break;
    }

    // unset sourceTimestamp unless AttributeId is Value
    if (attributeId !== AttributeIds.Value) {
        cloneDataValue.sourceTimestamp = null;
    }
    return cloneDataValue;
}

/*

 * @param dataValue
 * @param result
 * @return {DataValue}
 * @private
 * @static
 */
function _clone_with_array_replacement(dataValue: DataValue, result: any): DataValue {
    const statusCode = result.statusCode.isGood() ? dataValue.statusCode : result.statusCode;

    const clonedDataValue = new DataValue({
        statusCode,

        serverTimestamp: dataValue.serverTimestamp,

        serverPicoseconds: dataValue.serverPicoseconds,

        sourceTimestamp: dataValue.sourceTimestamp,

        sourcePicoseconds: dataValue.sourcePicoseconds,

        value: {
            dataType: DataType.Null
        }
    });
    clonedDataValue.value.dataType = dataValue.value.dataType;
    clonedDataValue.value.arrayType = dataValue.value.arrayType;
    clonedDataValue.value.dimensions = result.dimensions;

    if (Array.isArray(result.array)) {
        clonedDataValue.value.value = [...result.array];
    } else {
        clonedDataValue.value.value = result.array;
    }
    return clonedDataValue;
}

function canRange(dataValue: DataValue): boolean {
    return (
        dataValue.value &&
        (dataValue.value.arrayType !== VariantArrayType.Scalar ||
            (dataValue.value.arrayType === VariantArrayType.Scalar && dataValue.value.dataType === DataType.ByteString) ||
            (dataValue.value.arrayType === VariantArrayType.Scalar && dataValue.value.dataType === DataType.String))
    );
}

/**
 * return a deep copy of the dataValue by applying indexRange if necessary on  Array/Matrix
 * @param dataValue {DataValue}
 * @param indexRange {NumericalRange}
 * @return {DataValue}
 */
export function extractRange(dataValue: DataValue, indexRange: NumericalRange): DataValue {
    const variant = dataValue.value;
    if (indexRange && canRange(dataValue)) {
        if (!indexRange.isValid()) {
            return new DataValue({ statusCode: StatusCodes.BadIndexRangeInvalid });
        }
        // let's extract an array of elements corresponding to the indexRange
        const result = indexRange.extract_values(variant.value, variant.dimensions);
        dataValue = _clone_with_array_replacement(dataValue, result);
    } else {
        // clone the whole data Value
        dataValue = dataValue.clone();
    }
    return dataValue;
}

function sameDate(date1: DateTime, date2: DateTime): boolean {
    if (date1 === date2) {
        return true;
    }
    if (date1 && date2 === null) {
        return false;
    }
    if (date1 === null && date2) {
        return false;
    }
    if (date1 === null || date2 === null) {
        return false;
    }
    return date1.getTime() === date2.getTime();
}

/**
 * returns true if the sourceTimestamp and sourcePicoseconds of the two dataValue are different
 * @param dataValue1 
 * @param dataValue2 
 * @returns 
 */
export function sourceTimestampHasChanged(dataValue1: DataValue, dataValue2: DataValue): boolean {
    return (
        !sameDate(dataValue1.sourceTimestamp, dataValue2.sourceTimestamp) ||
        dataValue1.sourcePicoseconds !== dataValue2.sourcePicoseconds
    );
}

/**
 * returns true if the serverTimestamp and serverPicoseconds of the two dataValue are different
 * @param dataValue1 
 * @param dataValue2 
 * @returns 
 */
export function serverTimestampHasChanged(dataValue1: DataValue, dataValue2: DataValue): boolean {
    return (
        !sameDate(dataValue1.serverTimestamp, dataValue2.serverTimestamp) ||
        dataValue1.serverPicoseconds !== dataValue2.serverPicoseconds
    );
}


/**
 * return if the timestamps of the two dataValue are different
 * 
 * - if timestampsToReturn is not specified, both sourceTimestamp are compared
 * - if timestampsToReturn is **Neither**, the function returns false
 * - if timestampsToReturn is **Both**, both sourceTimestamp and serverTimestamp are compared
 * - if timestampsToReturn is **Source**, only sourceTimestamp are compared
 * - if timestampsToReturn is **Server**, only serverTimestamp are compared
 * 
 * @param dataValue1 
 * @param dataValue2 
 * @param timestampsToReturn 
 * @returns 
 */

export function timestampHasChanged(
    dataValue1: DataValue,
    dataValue2: DataValue,
    timestampsToReturn?: TimestampsToReturn
): boolean {
    // TODO:    timestampsToReturn = timestampsToReturn || { key: "Neither"};
    if (timestampsToReturn === undefined) {
        return sourceTimestampHasChanged(dataValue1, dataValue2); // || serverTimestampHasChanged(dataValue1, dataValue2);
    }
    switch (timestampsToReturn) {
        case TimestampsToReturn.Neither:
            return false;
        case TimestampsToReturn.Both:
            return sourceTimestampHasChanged(dataValue1, dataValue2) || serverTimestampHasChanged(dataValue1, dataValue2);
        case TimestampsToReturn.Source:
            return sourceTimestampHasChanged(dataValue1, dataValue2);
        default:
            assert(timestampsToReturn === TimestampsToReturn.Server);
            return serverTimestampHasChanged(dataValue1, dataValue2);
    }
}

/**
 * @param statusCode1 
 * @param statusCode2 
 * @returns true if the two statusCodes are identical, i.e have the same value
 */
export function sameStatusCode(statusCode1: StatusCode, statusCode2: StatusCode): boolean {
    return statusCode1.value === statusCode2.value;
}

/**
 * @return {boolean} true if data values are identical
 */
export function sameDataValue(v1: DataValue, v2: DataValue, timestampsToReturn?: TimestampsToReturn): boolean {
    if (v1 === v2) {
        return true;
    }
    if (v1 && !v2) {
        return false;
    }
    if (v2 && !v1) {
        return false;
    }
    if (!sameStatusCode(v1.statusCode, v2.statusCode)) {
        return false;
    }

    if (timestampHasChanged(v1, v2, timestampsToReturn)) {
        return false;
    }
    return sameVariant(v1.value, v2.value);
}
/**
 * a DataValueOptions specialized for a specific DataType
 */
export interface DataValueOptionsT<T, DT extends DataType> extends DataValueOptions {
    value: VariantOptionsT<T, DT>;
}

/**
 * a DataValue specialized for a specific DataType
 */
export declare interface DataValueT<T, DT extends DataType> extends DataValue {
    value: VariantT<T, DT>;
}
export class DataValueT<T, DT extends DataType> extends DataValue {}
