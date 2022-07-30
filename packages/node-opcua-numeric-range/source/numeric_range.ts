/**
 * @module node-opcua-numeric-range
 */
import { debuglog } from "util";
import { assert } from "node-opcua-assert";

import { decodeString, encodeString, UAString, UInt8 } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { registerBasicType } from "node-opcua-factory";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

// OPC.UA Part 4 7.21 Numerical Range
// The syntax for the string contains one of the following two constructs. The first construct is the string
// representation of an individual integer. For example, '6' is   valid, but '6.0' and '3.2' are not. The
// minimum and maximum values that can be expressed are defined by the use of this parameter and
// not by this parameter type definition. The second construct is a range represented by two integers
// separated by the colon   (':') character. The first integer shall always have a lower value than the
// second. For example, '5:7' is valid, while '7:5' and '5:5' are not. The minimum and maximum values
// that can be expressed by these integers are defined by the use of this parameter , and not by this
// parameter type definition. No other characters, including white - space characters, are permitted.
// Multi- dimensional arrays can be indexed by specifying a range for each dimension separated by a ','.
//
// For example, a 2x2 block in a 4x4 matrix   could be selected with the range '1:2,0:1'. A single element
// in a multi - dimensional array can be selected by specifying a single number instead of a range.
// For example, '1,1' specifies selects the [1,1] element in a two dimensional array.
// Dimensions are specified in the order that they appear in the  ArrayDimensions Attribute.
// All dimensions shall be specified for a  NumericRange  to be valid.
//
// All indexes start with 0. The maximum value for any index is one less than the length of the
// dimension.

const NUMERIC_RANGE_EMPTY_STRING = "NumericRange:<Empty>";

// BNF of NumericRange
// The following BNF describes the syntax of the NumericRange parameter type.
// <numeric-range>    ::= <dimension> [',' <dimension>]
//     <dimension>    ::= <index> [':' <index>]
//         <index>    ::= <digit> [<digit>]
//         <digit>    ::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' |9'
//
// tslint:disable:object-literal-shorthand
// tslint:disable:only-arrow-functions
export const schemaNumericRange = {
    name: "NumericRange",
    subType: "String",

    defaultValue: (): NumericRange => {
        return new NumericRange();
    },
    encode: encodeNumericRange,

    decode: decodeNumericRange,

    random: (): NumericRange => {
        function r() {
            return Math.ceil(Math.random() * 100);
        }

        const start = r();
        const end = start + r();
        return new NumericRange(start, end);
    },

    coerce: coerceNumericRange
};

registerBasicType(schemaNumericRange);

export enum NumericRangeType {
    Empty = 0,
    SingleValue = 1,
    ArrayRange = 2,
    MatrixRange = 3,
    InvalidRange = 4
}

// new Enum(["Empty", "SingleValue", "ArrayRange", "MatrixRange", "InvalidRange"]);

const regexNumericRange = /^[0-9:,]*$/;

function _valid_range(low: number, high: number): boolean {
    return !(low >= high || low < 0 || high < 0);
}

type NumericalRangeValueType = null | number | string | number[] | number[][];

export interface NumericalRangeSingleValue {
    type: NumericRangeType.SingleValue;
    value: number;
}

export interface NumericalRangeArrayRange {
    type: NumericRangeType.ArrayRange;
    value: number[];
}

export interface NumericalRangeMatrixRange {
    type: NumericRangeType.MatrixRange;
    value: number[][];
}

export interface NumericalRangeEmpty {
    type: NumericRangeType.Empty;
    value: null;
}

export interface NumericalRangeInvalid {
    type: NumericRangeType.InvalidRange;
    value: string;
}

export type NumericalRange0 =
    | NumericalRangeSingleValue
    | NumericalRangeArrayRange
    | NumericalRangeMatrixRange
    | NumericalRangeEmpty
    | NumericalRangeInvalid;

export interface NumericalRange1 {
    type: NumericRangeType;
    value: NumericalRangeValueType;
}

function construct_numeric_range_bit_from_string(str: string): NumericalRange0 {
    const values = str.split(":");

    if (values.length === 1) {
        return {
            type: NumericRangeType.SingleValue,
            value: parseInt(values[0], 10)
        };
    } else if (values.length === 2) {
        const array = values.map((a) => parseInt(a, 10));

        if (!_valid_range(array[0], array[1])) {
            return {
                type: NumericRangeType.InvalidRange,
                value: str
            };
        }
        return {
            type: NumericRangeType.ArrayRange,
            value: array
        };
    } else {
        return {
            type: NumericRangeType.InvalidRange,
            value: str
        };
    }
}

function _normalize(e: NumericalRange1): number | number[] {
    if (e.type === NumericRangeType.SingleValue) {
        const ee = e as NumericalRangeSingleValue;
        return [ee.value, ee.value];
    }
    return e.value as number;
}

function construct_numeric_range_from_string(str: string): NumericalRange0 {
    if (!regexNumericRange.test(str)) {
        return {
            type: NumericRangeType.InvalidRange,
            value: str
        };
    }
    /* detect multi dim range*/
    const values = str.split(",");

    if (values.length === 1) {
        return construct_numeric_range_bit_from_string(values[0]);
    } else if (values.length === 2) {
        const elements = values.map(construct_numeric_range_bit_from_string);
        let rowRange: any = elements[0];
        let colRange: any = elements[1];
        if (rowRange.type === NumericRangeType.InvalidRange || colRange.type === NumericRangeType.InvalidRange) {
            return { type: NumericRangeType.InvalidRange, value: str };
        }
        rowRange = _normalize(rowRange);
        colRange = _normalize(colRange);
        return {
            type: NumericRangeType.MatrixRange,
            value: [rowRange, colRange]
        };
    } else {
        // not supported yet
        return { type: NumericRangeType.InvalidRange, value: str };
    }
}

function construct_from_string(value: string): NumericalRange0 {
    return construct_numeric_range_from_string(value);
}

function _set_single_value(value: number | null): NumericalRange0 {
    if (value === null || value < 0 || !isFinite(value)) {
        return {
            type: NumericRangeType.InvalidRange,
            value: "" + value?.toString()
        };
    } else {
        return {
            type: NumericRangeType.SingleValue,
            value: value
        };
    }
}

function _check_range(numericalRange: NumericalRange0) {
    switch (numericalRange.type) {
        case NumericRangeType.ArrayRange:
            return _valid_range(numericalRange.value[0], numericalRange.value[1]);
    }
    // istanbul ignore next
    throw new Error("unsupported case");
}

function _set_range_value(low: number, high: number): NumericalRangeSingleValue | NumericalRangeArrayRange | NumericalRangeInvalid {
    if (low === high) {
        return {
            type: NumericRangeType.SingleValue,
            value: low
        };
    }
    const numericalRange: NumericalRangeArrayRange = {
        type: NumericRangeType.ArrayRange,
        value: [low, high]
    };
    if (!_check_range(numericalRange as NumericalRangeArrayRange)) {
        return {
            type: NumericRangeType.InvalidRange,
            value: ""
        };
    }
    return numericalRange;
}

function construct_from_values(value: number, secondValue?: number): NumericalRange0 {
    if (secondValue === undefined) {
        return _set_single_value(value);
    } else {
        if (!isFinite(secondValue)) {
            throw new Error(" invalid second argument, expecting a number");
        }
        return _set_range_value(value, secondValue);
    }
}

function _construct_from_array(value: number[], value2?: any): NumericalRange0 {
    assert(value.length === 2);

    // istanbul ignore next
    if (!isFinite(value[0]) || !isFinite(value[1])) {
        return { type: NumericRangeType.InvalidRange, value: "" + value };
    }
    let range1 = _set_range_value(value[0], value[1]);
    if (!value2) {
        return range1;
    }
    // we have a matrix
    const nr2 = new NumericRange(value2);
    // istanbul ignore next
    if (
        nr2.type === NumericRangeType.InvalidRange ||
        nr2.type === NumericRangeType.MatrixRange ||
        nr2.type === NumericRangeType.Empty
    ) {
        return { type: NumericRangeType.InvalidRange, value: "" + value };
    }
    if (range1.type === NumericRangeType.SingleValue) {
        range1 = {
            type: NumericRangeType.ArrayRange,
            value: [range1.value, range1.value]
        };
    }
    if (nr2.type === NumericRangeType.SingleValue) {
        nr2.type = NumericRangeType.ArrayRange;
        nr2.value = [nr2.value as number, nr2.value as number];
    }

    // istanbul ignore next
    return {
        type: NumericRangeType.MatrixRange,
        value: [range1.value as number[], nr2.value as number[]]
    };
}

export class NumericRange implements NumericalRange1 {
    public static coerce = coerceNumericRange;

    public static schema = schemaNumericRange;
    // tslint:disable:variable-name
    public static NumericRangeType = NumericRangeType;

    public static readonly empty = new NumericRange() as NumericalRange0;

    public static overlap(nr1?: NumericalRange0, nr2?: NumericalRange0): boolean {
        nr1 = nr1 || NumericRange.empty;
        nr2 = nr2 || NumericRange.empty;

        if (NumericRangeType.Empty === nr1.type || NumericRangeType.Empty === nr2.type) {
            return true;
        }
        if (NumericRangeType.SingleValue === nr1.type && NumericRangeType.SingleValue === nr2.type) {
            return nr1.value === nr2.value;
        }
        if (NumericRangeType.ArrayRange === nr1.type && NumericRangeType.ArrayRange === nr2.type) {
            // +-----+        +------+     +---+       +------+
            //     +----+       +---+    +--------+  +---+
            const l1 = nr1.value[0];
            const h1 = nr1.value[1];
            const l2 = nr2.value[0];
            const h2 = nr2.value[1];
            return _overlap(l1, h1, l2, h2);
        }
        // istanbul ignore next
        assert(false, "NumericalRange#overlap : case not implemented yet "); // TODO
        // istanbul ignore next
        return false;
    }

    public type: NumericRangeType;
    public value: NumericalRangeValueType;

    constructor();
    // tslint:disable-next-line: unified-signatures
    constructor(value: string | null);
    // tslint:disable-next-line: unified-signatures
    constructor(value: number, secondValue?: number);
    // tslint:disable-next-line: unified-signatures
    constructor(value: number[]);
    // tslint:disable-next-line: unified-signatures
    constructor(value: number[], secondValue: number[]);
    constructor(value?: null | string | number | number[], secondValue?: number | number[]) {
        this.type = NumericRangeType.InvalidRange;
        this.value = null;

        assert(!value || !(value instanceof NumericRange), "use coerce to create a NumericRange");
        assert(!secondValue || typeof secondValue === "number" || Array.isArray(secondValue));
        if (typeof value === "string") {
            const a = construct_from_string(value as string);
            this.type = a.type;
            this.value = a.value;
        } else if (
            typeof value === "number" &&
            isFinite(value) &&
            (secondValue === undefined || (typeof secondValue === "number" && isFinite(secondValue)))
        ) {
            const a = construct_from_values(value, secondValue);
            this.type = a.type;
            this.value = a.value;
        } else if (Array.isArray(value)) {
            const a = _construct_from_array(value, secondValue);
            this.type = a.type;
            this.value = a.value;
        } else {
            this.value = "<invalid>";
            this.type = NumericRangeType.Empty;
        }

        // xx assert((this.type !== NumericRangeType.ArrayRange) || Array.isArray(this.value));
    }

    public isValid(): boolean {
        if (this.type === NumericRangeType.ArrayRange) {
            const value = this.value as number[];
            if (value[0] < 0 || value[1] < 0) {
                return false;
            }
        }
        if (this.type === NumericRangeType.SingleValue) {
            const value = this.value as number;
            // istanbul ignore next
            if (value < 0) {
                return false;
            }
        }
        return this.type !== NumericRangeType.InvalidRange;
    }

    public isEmpty(): boolean {
        return this.type === NumericRangeType.Empty;
    }

    public isDefined(): boolean {
        return this.type !== NumericRangeType.Empty && this.type !== NumericRangeType.InvalidRange;
    }

    public toString(): string {
        function array_range_to_string(values: number[]): string {
            assert(Array.isArray(values));
            if (values.length === 2 && values[0] === values[1]) {
                return values[0].toString();
            }
            return values.map((value) => value.toString(10)).join(":");
        }

        function matrix_range_to_string(values: any) {
            return values
                .map((value: any) => {
                    return Array.isArray(value) ? array_range_to_string(value) : value.toString(10);
                })
                .join(",");
        }

        switch (this.type) {
            case NumericRangeType.SingleValue:
                return (this.value as any).toString(10);

            case NumericRangeType.ArrayRange:
                return array_range_to_string(this.value as number[]);

            case NumericRangeType.Empty:
                return NUMERIC_RANGE_EMPTY_STRING;

            case NumericRangeType.MatrixRange:
                return matrix_range_to_string(this.value);

            default:
                assert(this.type === NumericRangeType.InvalidRange);
                return "NumericRange:<Invalid>";
        }
    }

    public toJSON(): string {
        return this.toString();
    }

    public toEncodeableString(): UAString {
        switch (this.type) {
            case NumericRangeType.SingleValue:
            case NumericRangeType.ArrayRange:
            case NumericRangeType.MatrixRange:
                return this.toString();
            case NumericRangeType.InvalidRange:
                // istanbul ignore next
                if (!(typeof this.value === "string")) {
                    throw new Error("Internal Error");
                }
                return this.value; // value contains the original strings which was detected invalid
            default:
                return null;
        }
    }

    /**
     * @method extract_values
     * @param array   flat array containing values or string
     * @param dimensions: of the matrix if data is a matrix
     * @return {*}
     */
    public extract_values<U, T extends ArrayLike<U>>(array: T, dimensions?: number[]): ExtractResult<T> {
        const self = this as NumericalRange0;

        if (!array) {
            return {
                array,
                statusCode: this.type === NumericRangeType.Empty ? StatusCodes.Good : StatusCodes.BadIndexRangeNoData
            };
        }

        let index;
        let low_index;
        let high_index;
        let rowRange;
        let colRange;
        switch (self.type) {
            case NumericRangeType.Empty:
                return extract_empty(array, dimensions);

            case NumericRangeType.SingleValue:
                index = self.value;
                return extract_single_value(array, index);

            case NumericRangeType.ArrayRange:
                low_index = self.value[0];
                high_index = self.value[1];
                return extract_array_range(array, low_index, high_index);

            case NumericRangeType.MatrixRange:
                rowRange = self.value[0];
                colRange = self.value[1];
                return extract_matrix_range(array, rowRange, colRange, dimensions);

            default:
                return { statusCode: StatusCodes.BadIndexRangeInvalid };
        }
    }

    public set_values_matrix(
        sourceToAlter: { matrix: Buffer | []; dimensions: number[] },
        newMatrix: Buffer | []
    ): { matrix: Buffer | []; statusCode: StatusCode } {
        const { matrix, dimensions } = sourceToAlter;
        const self = this as NumericalRange0;
        assert(dimensions, "expecting valid dimensions here");
        if (self.type !== NumericRangeType.MatrixRange) {
            // istanbul ignore next
            return { matrix, statusCode: StatusCodes.BadTypeMismatch };
        }

        assert(dimensions.length === 2);
        const nbRows = dimensions[0];
        const nbCols = dimensions[1];
        assert(sourceToAlter.matrix.length === nbRows * nbCols);
        const [rowStart, rowEnd] = self.value[0];
        const [colStart, colEnd] = self.value[1];

        const nbRowInNew = rowEnd - rowStart + 1;
        const nbColInNew = colEnd - colStart + 1;
        if (nbRowInNew * nbColInNew !== newMatrix.length) {
            return { matrix, statusCode: StatusCodes.BadTypeMismatch };
        }
        // check if the sub-matrix is in th range of the initial matrix
        if (rowEnd >= nbRows || colEnd >= nbCols) {
            // debugLog("out of band range => ", { rowEnd, nbRows, colEnd, nbCols });
            return { matrix, statusCode: StatusCodes.BadTypeMismatch };
        }
        for (let row = rowStart; row <= rowEnd; row++) {
            const ri = row - rowStart;
            for (let col = colStart; col <= colEnd; col++) {
                const ci = col - colStart;
                matrix[row * nbCols + col] = newMatrix[ri * nbColInNew + ci];
            }
        }
        return {
            matrix,
            statusCode: StatusCodes.Good
        };
    }
    public set_values(arrayToAlter: Buffer | [], newValues: Buffer | []): { array: Buffer | [] | null; statusCode: StatusCode } {
        assert_array_or_buffer(arrayToAlter);
        assert_array_or_buffer(newValues);

        const self = this as NumericalRange0;

        let low_index;
        let high_index;
        switch (self.type) {
            case NumericRangeType.Empty:
                low_index = 0;
                high_index = arrayToAlter.length - 1;
                break;
            case NumericRangeType.SingleValue:
                low_index = self.value;
                high_index = self.value;
                break;
            case NumericRangeType.ArrayRange:
                low_index = self.value[0];
                high_index = self.value[1];
                break;
            case NumericRangeType.MatrixRange:
                // for the time being MatrixRange is not supported
                return { array: arrayToAlter, statusCode: StatusCodes.BadIndexRangeNoData };
            default:
                return { array: null, statusCode: StatusCodes.BadIndexRangeInvalid };
        }

        if (high_index >= arrayToAlter.length || low_index >= arrayToAlter.length) {
            return { array: null, statusCode: StatusCodes.BadIndexRangeNoData };
        }
        if (this.type !== NumericRangeType.Empty && newValues.length !== high_index - low_index + 1) {
            return { array: null, statusCode: StatusCodes.BadIndexRangeInvalid };
        }
        const insertInPlace = Array.isArray(arrayToAlter)
            ? insertInPlaceStandardArray
            : arrayToAlter instanceof Buffer
            ? insertInPlaceBuffer
            : insertInPlaceTypedArray;
        return {
            array: insertInPlace(arrayToAlter, low_index, high_index, newValues),
            statusCode: StatusCodes.Good
        };
    }
}

function slice<U, T extends ArrayLike<U>>(arr: T, start: number, end: number): T {
    if (start === 0 && end === arr.length) {
        return arr;
    }

    let res;
    if ((arr as any).buffer instanceof ArrayBuffer) {
        res = (arr as any).subarray(start, end);
    } else {
        assert(typeof (arr as any).slice === "function");
        assert(arr instanceof Buffer || arr instanceof Array || typeof arr === "string");
        res = (arr as any).slice(start, end);
    }
    if (res instanceof Uint8Array && arr instanceof Buffer) {
        // note in io-js 3.00 onward standard Buffer are implemented differently and
        // provides a buffer member and a subarray method, in fact in io-js 3.0
        // it seems that Buffer acts as a Uint8Array. in this very special case
        // we need to make sure that we end up with a Buffer object and not a Uint8Array.
        res = Buffer.from(res);
    }
    return res;
}

export interface ExtractResult<T> {
    array?: T | null;
    statusCode: StatusCode;
    dimensions?: number[];
}

function extract_empty<U, T extends ArrayLike<U>>(array: T, dimensions: any): ExtractResult<T> {
    return {
        array: slice(array, 0, array.length),
        dimensions,
        statusCode: StatusCodes.Good
    };
}

function extract_single_value<U, T extends ArrayLike<U>>(array: T, index: number): ExtractResult<T> {
    if (index >= array.length) {
        if (typeof array === "string") {
            return { array: "" as any as T, statusCode: StatusCodes.BadIndexRangeNoData };
        }
        return { array: null as any as T, statusCode: StatusCodes.BadIndexRangeNoData };
    }
    return {
        array: slice(array, index, index + 1),
        statusCode: StatusCodes.Good
    };
}

function extract_array_range<U, T extends ArrayLike<U>>(array: T, low_index: number, high_index: number): ExtractResult<T> {
    assert(isFinite(low_index) && isFinite(high_index));
    assert(low_index >= 0);
    assert(low_index <= high_index);
    if (low_index >= array.length) {
        if (typeof array === "string") {
            return { array: "" as any as T, statusCode: StatusCodes.BadIndexRangeNoData };
        }
        return { array: null as any as T, statusCode: StatusCodes.BadIndexRangeNoData };
    }
    // clamp high index
    high_index = Math.min(high_index, array.length - 1);

    return {
        array: slice(array, low_index, high_index + 1),
        statusCode: StatusCodes.Good
    };
}

function isArrayLike(value: any): boolean {
    return typeof value.length === "number" || Object.prototype.hasOwnProperty.call(value, "length");
}

function extract_matrix_range<U, T extends ArrayLike<U>>(
    array: T,
    rowRange: number[],
    colRange: number[],
    dimension?: number[]
): ExtractResult<T> {
    assert(Array.isArray(rowRange) && Array.isArray(colRange));

    if (array.length === 0) {
        return {
            array: null,
            statusCode: StatusCodes.BadIndexRangeNoData
        };
    }
    if (isArrayLike((array as any)[0]) && !dimension) {
        // like extracting data from a one dimensional array of strings or byteStrings...
        const result = extract_array_range(array, rowRange[0], rowRange[1]);
        for (let i = 0; i < result.array!.length; i++) {
            const e = (result.array! as any)[i];
            (result.array as any)[i] = extract_array_range(e, colRange[0], colRange[1]).array;
        }
        return result;
    }
    if (!dimension) {
        return {
            array: null,
            statusCode: StatusCodes.BadIndexRangeNoData
        };
    }

    assert(dimension, "expecting dimension to know the shape of the matrix represented by the flat array");

    //
    const rowLow = rowRange[0];
    const rowHigh = rowRange[1];
    const colLow = colRange[0];
    const colHigh = colRange[1];

    const nbRow = dimension[0];
    const nbCol = dimension[1];

    const nbRowDest = rowHigh - rowLow + 1;
    const nbColDest = colHigh - colLow + 1;

    // construct an array of the same type with the appropriate length to
    // store the extracted matrix.
    const tmp = new (array as any).constructor(nbColDest * nbRowDest);

    let row;
    let col;
    let r;
    let c;
    r = 0;
    for (row = rowLow; row <= rowHigh; row++) {
        c = 0;
        for (col = colLow; col <= colHigh; col++) {
            const srcIndex = row * nbCol + col;
            const destIndex = r * nbColDest + c;
            tmp[destIndex] = (array as any)[srcIndex];
            c++;
        }
        r += 1;
    }
    return {
        array: tmp,
        dimensions: [nbRowDest, nbColDest],
        statusCode: StatusCodes.Good
    };
}

function assert_array_or_buffer(array: any) {
    assert(Array.isArray(array) || array.buffer instanceof ArrayBuffer || array instanceof Buffer);
}

function insertInPlaceStandardArray(arrayToAlter: any, low: number, high: number, newValues: any): any {
    const args = [low, high - low + 1].concat(newValues);
    arrayToAlter.splice(...args);
    return arrayToAlter;
}

function insertInPlaceTypedArray(arrayToAlter: any, low: number, high: number, newValues: any): any {
    if (low === 0 && high === arrayToAlter.length - 1) {
        return new arrayToAlter.constructor(newValues);
    }
    assert(newValues.length === high - low + 1);
    arrayToAlter.subarray(low, high + 1).set(newValues);
    return arrayToAlter;
}

function insertInPlaceBuffer(bufferToAlter: Buffer | [], low: number, high: number, newValues: any): Buffer {
    // insertInPlaceBuffer with buffer is not really possible as existing Buffer cannot be resized
    if (!(bufferToAlter instanceof Buffer)) throw new Error("expecting a buffer");
    if (low === 0 && high === bufferToAlter.length - 1) {
        bufferToAlter = Buffer.from(newValues);
        return bufferToAlter;
    }
    assert(newValues.length === high - low + 1);
    for (let i = 0; i < newValues.length; i++) {
        bufferToAlter[i + low] = newValues[i];
    }
    return bufferToAlter;
}

function _overlap(l1: number, h1: number, l2: number, h2: number): boolean {
    return Math.max(l1, l2) <= Math.min(h1, h2);
}

export function encodeNumericRange(numericRange: NumericRange, stream: OutputBinaryStream): void {
    assert(numericRange instanceof NumericRange);
    encodeString(numericRange.toEncodeableString(), stream);
}

export function decodeNumericRange(stream: BinaryStream, _value?: NumericRange): NumericRange {
    const str = decodeString(stream)!;
    return new NumericRange(str);
}

function coerceNumericRange(value: any | string | NumericRange | null | number[]): NumericRange {
    if (value instanceof NumericRange) {
        return value;
    }
    if (value === null || value === undefined) {
        return new NumericRange();
    }
    if (value === NUMERIC_RANGE_EMPTY_STRING) {
        return new NumericRange();
    }
    assert(typeof value === "string" || Array.isArray(value));
    return new NumericRange(value);
}
