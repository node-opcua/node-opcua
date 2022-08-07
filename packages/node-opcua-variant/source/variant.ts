/**
 * @module node-opcua-variant
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import {
    coerceInt64,
    coerceUInt64,
    decodeUInt32,
    decodeUInt8,
    encodeUInt32,
    encodeUInt8,
    isValidBoolean,
    isValidByteString,
    isValidInt16,
    isValidInt32,
    isValidInt64,
    isValidInt8,
    isValidNodeId,
    isValidUInt16,
    isValidUInt32,
    isValidUInt64,
    isValidUInt8
} from "node-opcua-basic-types";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import {
    BaseUAObject,
    buildStructuredType,
    findBuiltInType,
    initialize_field,
    registerSpecialVariantEncoder,
    StructuredTypeSchema,
    registerType,
    DecodeDebugOptions
} from "node-opcua-factory";

import * as utils from "node-opcua-utils";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { _enumerationDataType, DataType } from "./DataType_enum";
import { _enumerationVariantArrayType, VariantArrayType } from "./VariantArrayType_enum";
// tslint:disable:no-bitwise

const schemaVariant: StructuredTypeSchema = buildStructuredType({
    baseType: "BaseUAObject",
    fields: [
        {
            defaultValue: DataType.Null,
            documentation: "the variant type.",
            fieldType: "DataType",
            name: "dataType"
        },
        {
            defaultValue: VariantArrayType.Scalar,
            fieldType: "VariantArrayType",
            name: "arrayType"
        },
        {
            defaultValue: null,
            fieldType: "Any",
            name: "value"
        },
        {
            defaultValue: null,
            documentation: "the matrix dimensions",
            fieldType: "UInt32",
            isArray: true,
            name: "dimensions"
        }
    ],
    name: "Variant"
});

function _coerceVariant(variantLike: VariantOptions | Variant): Variant {
    const value = variantLike instanceof Variant ? variantLike : new Variant(variantLike);
    return value;
}

export interface VariantOptions {
    dataType?: DataType | string;
    arrayType?: VariantArrayType | string;
    value?: any;
    dimensions?: number[] | null;
}

export interface VariantOptions2 {
    dataType: DataType;
    arrayType: VariantArrayType;
    value: any;
    dimensions: number[] | null;
}

export class Variant extends BaseUAObject {
    public static maxTypedArrayLength = 16 * 1024 * 1024;
    public static maxArrayLength = 1 * 1024 * 1024;

    public static schema = schemaVariant;
    public static coerce = _coerceVariant;
    public static computer_default_value = (): Variant => new Variant({ dataType: DataType.Null });
    public dataType: DataType;
    public arrayType: VariantArrayType;
    public value: any;
    public dimensions: number[] | null;

    constructor(options?: VariantOptions | null) {
        super();

        if (options === null) {
            this.dataType = DataType.Null;
            this.arrayType = VariantArrayType.Scalar;
            this.value = null;
            this.dimensions = null;
            return;
        }
        const options2 = constructHook(options || {});

        this.dataType = DataType.Null;
        this.arrayType = VariantArrayType.Scalar;

        const schema = schemaVariant;
        this.dataType = options2.dataType;
        this.arrayType = options2.arrayType;
        this.value = initialize_field(schema.fields[2], options2.value);
        this.dimensions = options2.dimensions || null;

        if (this.dataType === DataType.ExtensionObject) {
            if (this.arrayType === VariantArrayType.Scalar) {
                /* istanbul ignore next */
                if (this.value && !(this.value instanceof BaseUAObject)) {
                    throw new Error(
                        `A variant with DataType.ExtensionObject must have a ExtensionObject value.\nMake sure that you specify a valid ExtensionObject to the value options in the Variant Constructor`
                    );
                }
            } else {
                if (this.value) {
                    for (const e of this.value) {
                        /* istanbul ignore next */
                        if (e && !(e instanceof BaseUAObject)) {
                            throw new Error(
                                "A variant with DataType.ExtensionObject must have a ExtensionObject value\nMake sure that you specify a valid ExtensionObject for all element of the value array passed to the  Variant Constructor`"
                            );
                        }
                    }
                }
            }
        }
    }
    public encode(stream: OutputBinaryStream): void {
        encodeVariant(this, stream);
    }

    public decode(stream: BinaryStream): void {
        internalDecodeVariant(this, stream);
    }

    public decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void {
        decodeDebugVariant(this, stream, options);
    }

    public toString(): string {
        return variantToString(this);
    }
    public isValid(): boolean {
        return isValidVariant(this.arrayType, this.dataType, this.value, this.dimensions);
    }

    public clone(): Variant {
        return new Variant(this);
    }
}

Variant.prototype.schema = schemaVariant;

export type VariantLike = VariantOptions;

function variantToString(self: Variant, options?: any) {
    function toString(value: any): string {
        switch (self.dataType) {
            case DataType.ByteString:
                return value ? "0x" + value.toString("hex") : "<null>";
            case DataType.NodeId:
                return value instanceof NodeId ? (value as NodeId).displayText() : value ? value.toString(options) : "";
            case DataType.Boolean:
                return value.toString();
            case DataType.DateTime:
                return value ? (value.toISOString ? value.toISOString() : value.toString()) : "<null>";
            default:
                return value ? value.toString(options) : "0";
        }
    }

    function f(value: any) {
        if (value === undefined || (value === null && typeof value === "object")) {
            return "<null>";
        }
        return toString(value);
    }

    let data = VariantArrayType[self.arrayType];

    if (self.dimensions && self.dimensions.length >= 0) {
        data += "[ " + self.dimensions.join(",") + " ]";
    }

    data += "<" + DataType[self.dataType] + ">";
    if (self.arrayType === VariantArrayType.Scalar) {
        data += ", value: " + f(self.value);
    } else if (self.arrayType === VariantArrayType.Array || self.arrayType === VariantArrayType.Matrix) {
        if (!self.value) {
            data += ", null";
        } else {
            const a = [];
            assert(Array.isArray(self.value) || self.value.buffer instanceof ArrayBuffer);
            for (let i = 0; i < Math.min(10, self.value.length); i++) {
                a[i] = self.value[i];
            }
            if (self.value.length > 10) {
                a.push("...");
            }
            data += ", l= " + self.value.length + ", value=[" + a.map(f).join(",") + "]";
        }
    }
    return "Variant(" + data + ")";
}

/***
 * @private
 */
export const VARIANT_ARRAY_MASK = 0x80;
/***
 * @private
 */
export const VARIANT_ARRAY_DIMENSIONS_MASK = 0x40;
/***
 * @private
 */
export const VARIANT_TYPE_MASK = 0x3f;

const nullVariant = new Variant({ dataType: DataType.Null });
/***
 * @private
 */
export function encodeVariant(variant: Variant | undefined | null, stream: OutputBinaryStream): void {
    try {
        if (!variant) {
            variant = nullVariant;
        }
        let encodingByte = variant.dataType;

        if (variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix) {
            encodingByte |= VARIANT_ARRAY_MASK;
        }
        if (variant.dimensions) {
            assert(variant.arrayType === VariantArrayType.Matrix);
            assert(variant.dimensions.length >= 0);
            encodingByte |= VARIANT_ARRAY_DIMENSIONS_MASK;
        }
        encodeUInt8(encodingByte, stream);

        if (variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix) {
            encodeVariantArray(variant.dataType, stream, variant.value);
        } else {
            const encode = get_encoder(variant.dataType || DataType.Null);
            encode(variant.value, stream);
        }

        if ((encodingByte & VARIANT_ARRAY_DIMENSIONS_MASK) === VARIANT_ARRAY_DIMENSIONS_MASK && variant.dimensions) {
            encodeDimension(variant.dimensions, stream);
        }
    } catch (err) {
        console.log("Error encoding variant", err);
        console.log(variant?.toString());
        throw err;
    }
}

/***
 * @private
 */
function decodeDebugVariant(self: Variant, stream: BinaryStream, options: DecodeDebugOptions): void {
    const tracer = options.tracer;

    const encodingByte = decodeUInt8(stream);

    const isArray = (encodingByte & VARIANT_ARRAY_MASK) === VARIANT_ARRAY_MASK;
    const hasDimension = (encodingByte & VARIANT_ARRAY_DIMENSIONS_MASK) === VARIANT_ARRAY_DIMENSIONS_MASK;

    self.dataType = (encodingByte & VARIANT_TYPE_MASK) as DataType;

    tracer.dump("dataType:  ", self.dataType);
    tracer.dump("isArray:   ", isArray ? "true" : "false");
    tracer.dump("dimension: ", hasDimension);

    const decode = findBuiltInType(DataType[self.dataType]).decode;

    /* istanbul ignore next */
    if (!decode) {
        throw new Error("Variant.decode : cannot find decoder for type " + DataType[self.dataType]);
    }

    const cursorBefore = stream.length;

    if (isArray) {
        self.arrayType = hasDimension ? VariantArrayType.Matrix : VariantArrayType.Array;
        _decodeVariantArrayDebug(stream, decode, tracer, self.dataType);
    } else {
        self.arrayType = VariantArrayType.Scalar;
        self.value = decode(stream);
        tracer.trace("member", "Variant", self.value, cursorBefore, stream.length, DataType[self.dataType]);
    }

    // ArrayDimensions
    // Int32[]
    //  The length of each dimension.
    //    This field is only present if the array dimensions flag is set in the encoding mask.
    //    The lower rank dimensions appear first in the array.
    //    All dimensions shall be specified and shall be greater than zero.
    //    If ArrayDimensions are inconsistent with the ArrayLength then the decoder shall
    //   stop and raise a BadDecodingError.
    if (hasDimension) {
        self.dimensions = decodeDimension(stream);
        const verification = calculate_product(self.dimensions);
    }
}

function internalDecodeVariant(self: Variant, stream: BinaryStream) {
    const encodingByte = decodeUInt8(stream);

    const isArray: boolean = (encodingByte & VARIANT_ARRAY_MASK) === VARIANT_ARRAY_MASK;

    const hasDimension: boolean = (encodingByte & VARIANT_ARRAY_DIMENSIONS_MASK) === VARIANT_ARRAY_DIMENSIONS_MASK;

    self.dataType = (encodingByte & VARIANT_TYPE_MASK) as DataType;

    if (isArray) {
        self.arrayType = hasDimension ? VariantArrayType.Matrix : VariantArrayType.Array;
        self.value = decodeVariantArray(self.dataType, stream);
    } else {
        self.arrayType = VariantArrayType.Scalar;
        const decode = get_decoder(self.dataType);
        self.value = decode(stream);
    }
    if (hasDimension) {
        self.dimensions = decodeDimension(stream);
        const verification = calculate_product(self.dimensions);
        /* istanbul ignore next */
        if (verification !== self.value.length) {
            throw new Error("BadDecodingError");
        }
    }
}

/***
 * @private
 */
export function decodeVariant(stream: BinaryStream, value?: Variant): Variant {
    value = value || new Variant(null);
    value.decode(stream);
    return value;
}

function constructHook(options: VariantOptions | Variant): VariantOptions2 {
    let isArrayTypeUnspecified = options.arrayType === undefined;

    if (options instanceof Variant) {
        const opts: VariantOptions2 = {
            arrayType: options.arrayType,
            dataType: options.dataType,
            dimensions: options.dimensions,
            value: options.value
        };

        if (opts.dataType === DataType.ExtensionObject) {
            if (opts.arrayType === VariantArrayType.Scalar) {
                if (opts.value && opts.value.constructor) {
                    opts.value = new opts.value.constructor(opts.value);
                }
            } else {
                if (opts.value) {
                    opts.value = opts.value.map((e: any) => {
                        if (e && e.constructor) {
                            return new e.constructor(e);
                        }
                        return null;
                    });
                }
            }
        } else if (opts.arrayType !== VariantArrayType.Scalar) {
            opts.value = coerceVariantArray(opts.dataType, options.value);
        }
        return opts;
    }
    options.dataType = options.dataType || DataType.Null;

    // dataType could be a string
    if (typeof options.dataType === "string") {
        const d = findBuiltInType(options.dataType);
        /* istanbul ignore next */
        if (!d) {
            throw new Error("Cannot find Built-In data type or any DataType resolving to " + options.dataType);
        }
        options.dataType = DataType[d.name as keyof typeof DataType];
    }

    // array type could be a string
    if (typeof options.arrayType === "string") {
        const at: VariantArrayType | undefined = (VariantArrayType as any)[options.arrayType];
        /* istanbul ignore next */
        if (at === undefined) {
            throw new Error("ArrayType: invalid " + options.arrayType);
        }
        options.arrayType = at;
    }

    if (isArrayTypeUnspecified && Array.isArray(options.value)) {
        // when using UInt64 ou Int64 arrayType must be specified , as automatic detection cannot be made

        /* istanbul ignore next */
        if (options.dataType === DataType.UInt64 || options.dataType === DataType.Int64) {
            // we do nothing here ....
            throw new Error(
                "Variant#constructor : when using UInt64 ou Int64" +
                    " arrayType must be specified , as automatic detection cannot be made"
            );
        } else {
            options.arrayType = VariantArrayType.Array;
            isArrayTypeUnspecified = false;
        }
    }

    if (options.arrayType !== VariantArrayType.Scalar && !isArrayTypeUnspecified) {
        assert(options.arrayType === VariantArrayType.Array || options.arrayType === VariantArrayType.Matrix);
        /* istanbul ignore else */
        if (options.arrayType === VariantArrayType.Array) {
            const value1 = coerceVariantArray(options.dataType, options.value);
            assert(value1 === null || value1 !== options.value);
            options.value = value1;
        } else {
            assert(options.arrayType === VariantArrayType.Matrix);
            options.value = options.value || [];

            options.value = coerceVariantArray(options.dataType, options.value);

            /* istanbul ignore next */
            if (!options.dimensions) {
                throw new Error("Matrix Variant : missing dimensions");
            }
            /* istanbul ignore next */
            if (options.value.length !== calculate_product(options.dimensions)) {
                throw new Error(
                    "Matrix Variant : invalid value size = options.value.length " +
                        options.value.length +
                        "!=" +
                        calculate_product(options.dimensions) +
                        " => " +
                        JSON.stringify(options.dimensions)
                );
            }
        }
    } else {
        assert(options.arrayType === VariantArrayType.Scalar || options.arrayType === undefined);
        options.arrayType = VariantArrayType.Scalar;
        const tmp = options.value;
        // scalar
        options.value = coerceVariantType(options.dataType, options.value);

        /* istanbul ignore next */
        if (!isValidVariant(options.arrayType, options.dataType, options.value, null)) {
            throw new Error(
                "Invalid variant arrayType: " +
                    VariantArrayType[options.arrayType] +
                    "  dataType: " +
                    DataType[options.dataType] +
                    " value:" +
                    options.value +
                    " (javascript type = " +
                    typeof options.value +
                    " )"
            );
        }
    }
    if (options.dimensions) {
        assert(options.arrayType === VariantArrayType.Matrix, "dimension can only provided if variant is a matrix");
    }
    return options as VariantOptions2;
}

function calculate_product(array: number[] | null): number {
    /* istanbul ignore next */
    if (!array || array.length === 0) {
        return 0;
    }
    return array.reduce((n: number, p: number) => n * p, 1);
}

function get_encoder(dataType: DataType) {
    const dataTypeAsString = typeof dataType === "string" ? dataType : DataType[dataType];
    /* istanbul ignore next */
    if (!dataTypeAsString) {
        throw new Error("invalid dataType " + dataType);
    }
    const encode = findBuiltInType(dataTypeAsString).encode;
    /* istanbul ignore next */
    if (!encode) {
        throw new Error("Cannot find encode function for dataType " + dataTypeAsString);
    }
    return encode;
}

function get_decoder(dataType: DataType) {
    const dataTypeAsString = DataType[dataType];
    const decode = findBuiltInType(dataTypeAsString).decode;
    /* istanbul ignore next */
    if (!decode) {
        throw new Error("Variant.decode : cannot find decoder for type " + dataTypeAsString);
    }
    return decode;
}

const displayWarning = true;

/***
 * @private
 */
export type BufferedArray2 =
    | Float32Array
    | Float64Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Uint8Array
    | Uint16Array
    | Uint32Array;

interface BufferedArrayConstructor {
    BYTES_PER_ELEMENT: number;
    new (buffer: any): any;
}

function convertTo(dataType: DataType, arrayTypeConstructor: BufferedArrayConstructor | null, value: any) {
    // istanbul ignore next
    if (value === undefined || value === null) {
        return null;
    }

    if (arrayTypeConstructor && value instanceof arrayTypeConstructor) {
        const newArray = new value.constructor(value.length); // deep copy

        /* istanbul ignore if */
        if (newArray instanceof Buffer) {
            // required for nodejs 4.x
            value.copy(newArray);
        } else {
            newArray.set(value);
        }

        return newArray;
    }
    const coerceFunc = coerceVariantType.bind(null, dataType);
    const n = value.length;

    const newArr: any = arrayTypeConstructor ? new arrayTypeConstructor(n) : new Array(n);
    for (let i = 0; i < n; i++) {
        newArr[i] = coerceFunc(value[i]);
    }
    // istanbul ignore next
    if (arrayTypeConstructor && displayWarning && n > 10) {
        // tslint:disable-next-line:no-console
        console.log("Warning ! an array containing  " + DataType[dataType] + " elements has been provided as a generic array. ");
        // tslint:disable-next-line:no-console
        console.log(
            "          This is inefficient as every array value will " + "have to be coerced and verified against the expected type"
        );
        // tslint:disable-next-line:no-console
        console.log(
            "          It is highly recommended that you use a " + " typed array ",
            arrayTypeConstructor.constructor.name,
            " instead"
        );
    }
    return newArr;
}

interface DataTypeHelper {
    coerce: (value: any) => any;
    encode: (stream: OutputBinaryStream, value: any) => void;
    decode: (stream: BinaryStream) => any;
}

const typedArrayHelpers: { [key: string]: DataTypeHelper } = {};

function _getHelper(dataType: DataType) {
    return typedArrayHelpers[DataType[dataType]];
}

function coerceVariantArray(dataType: DataType, value: any) {
    const helper = _getHelper(dataType);
    if (helper) {
        return helper.coerce(value);
    } else {
        return convertTo(dataType, null, value);
    }
}

function encodeTypedArray(arrayTypeConstructor: BufferedArrayConstructor, stream: OutputBinaryStream, value: any) {
    assert(value instanceof arrayTypeConstructor);
    assert(value.buffer instanceof ArrayBuffer);
    encodeUInt32(value.length, stream);
    stream.writeArrayBuffer(value.buffer, value.byteOffset, value.byteLength);
}

function encodeGeneralArray(dataType: DataType, stream: OutputBinaryStream, value: any[] | null) {
    if (!value) {
        assert(value === null);
        encodeUInt32(0xffffffff, stream);
        return;
    }
    encodeUInt32(value.length, stream);
    const encode = get_encoder(dataType);
    for (const e of value) {
        encode(e, stream);
    }
}

function encodeVariantArray(dataType: DataType, stream: OutputBinaryStream, value: any) {
    if (value && value.buffer) {
        return _getHelper(dataType).encode(stream, value);
    }
    return encodeGeneralArray(dataType, stream, value);
}

function decodeTypedArray(arrayTypeConstructor: BufferedArrayConstructor, stream: BinaryStream) {
    const length = decodeUInt32(stream);

    /* istanbul ignore next */
    if (length === 0xffffffff) {
        return null;
    }
    if (length > Variant.maxTypedArrayLength) {
        throw new Error(
            `maxTypedArrayLength(${Variant.maxTypedArrayLength}) has been exceeded in Variant.decodeArray (typed Array) len=${length}`
        );
    }
    const byteLength = length * arrayTypeConstructor.BYTES_PER_ELEMENT;
    const arr = stream.readArrayBuffer(byteLength);
    const value = new arrayTypeConstructor(arr.buffer);
    assert(value.length === length);
    return value;
}

function decodeGeneralArray(dataType: DataType, stream: BinaryStream) {
    const length = decodeUInt32(stream);

    /* istanbul ignore next */
    if (length === 0xffffffff) {
        return null;
    }
    if (length > Variant.maxArrayLength) {
        throw new Error(`maxArrayLength(${Variant.maxArrayLength}) has been exceeded in Variant.decodeArray len=${length}`);
    }
    const decode = get_decoder(dataType);

    const arr = [];
    for (let i = 0; i < length; i++) {
        arr.push(decode(stream));
    }
    return arr;
}

function decodeVariantArray(dataType: DataType, stream: BinaryStream) {
    const helper = _getHelper(dataType);
    if (helper) {
        return helper.decode(stream);
    } else {
        return decodeGeneralArray(dataType, stream);
    }
}

function _declareTypeArrayHelper(dataType: DataType, typedArrayConstructor: any) {
    typedArrayHelpers[DataType[dataType]] = {
        coerce: convertTo.bind(null, dataType, typedArrayConstructor),
        decode: decodeTypedArray.bind(null, typedArrayConstructor),
        encode: encodeTypedArray.bind(null, typedArrayConstructor)
    };
}

_declareTypeArrayHelper(DataType.Float, Float32Array);
_declareTypeArrayHelper(DataType.Double, Float64Array);
_declareTypeArrayHelper(DataType.SByte, Int8Array);
_declareTypeArrayHelper(DataType.Byte, Uint8Array);
_declareTypeArrayHelper(DataType.Int16, Int16Array);
_declareTypeArrayHelper(DataType.Int32, Int32Array);
_declareTypeArrayHelper(DataType.UInt16, Uint16Array);
_declareTypeArrayHelper(DataType.UInt32, Uint32Array);

function _decodeVariantArrayDebug(stream: BinaryStream, decode: any, tracer: any, dataType: DataType) {
    let cursorBefore = stream.length;
    const length = decodeUInt32(stream);

    let i;
    let element;
    tracer.trace("start_array", "Variant", -1, cursorBefore, stream.length);
    if (length === 0xffffffff) {
        // empty array
        tracer.trace("end_array", "Variant", stream.length);
        return;
    }

    const n1 = Math.min(10, length);

    // display a maximum of 10 elements
    for (i = 0; i < n1; i++) {
        tracer.trace("start_element", "", i);
        cursorBefore = stream.length;
        element = decode(stream);
        // arr.push(element);
        tracer.trace("member", "Variant", element, cursorBefore, stream.length, DataType[dataType]);
        tracer.trace("end_element", "", i);
    }
    // keep reading
    if (length >= n1) {
        for (i = n1; i < length; i++) {
            decode(stream);
        }
        tracer.trace("start_element", "", n1);
        tracer.trace("member", "Variant", "...", cursorBefore, stream.length, DataType[dataType]);
        tracer.trace("end_element", "", n1);
    }
    tracer.trace("end_array", "Variant", stream.length);
}

function decodeDimension(stream: BinaryStream) {
    return decodeGeneralArray(DataType.UInt32, stream);
}

function encodeDimension(dimensions: number[], stream: OutputBinaryStream) {
    return encodeGeneralArray(DataType.UInt32, stream, dimensions);
}

function isEnumerationItem(value: any): boolean {
    return (
        value instanceof Object &&
        Object.prototype.hasOwnProperty.call(value, "value") &&
        Object.prototype.hasOwnProperty.call(value, "key") &&
        value.constructor.name === "EnumValueType"
    );
}

export function coerceVariantType(dataType: DataType, value: undefined | any): any {
    /* eslint max-statements: ["error",1000], complexity: ["error",1000]*/
    if (value === undefined) {
        value = null;
    }
    if (isEnumerationItem(value)) {
        // OPCUA Specification 1.0.3 5.8.2 encoding rules for various dataType:
        // [...]Enumeration are always encoded as Int32 on the wire [...]

        /* istanbul ignore next */
        if (dataType !== DataType.Int32 && dataType !== DataType.ExtensionObject) {
            throw new Error(
                "expecting DataType.Int32 for enumeration values ;" + " got DataType." + dataType.toString() + " instead"
            );
        }
    }

    switch (dataType) {
        case DataType.Null:
            value = null;
            break;

        case DataType.LocalizedText:
            if (!value || !value.schema || value.schema !== LocalizedText.schema) {
                value = new LocalizedText(value);
            }
            break;

        case DataType.QualifiedName:
            if (!value || !value.schema || value.schema !== QualifiedName.schema) {
                value = new QualifiedName(value);
            }
            break;
        case DataType.Int32:
        case DataType.Int16:
        case DataType.UInt32:
        case DataType.UInt16:
            assert(value !== undefined);
            value = parseInt(value, 10);
            /* istanbul ignore next */
            if (!isFinite(value)) {
                // xx console.log("xxx ", value, ttt);
                throw new Error("expecting a number " + value);
            }
            break;
        case DataType.UInt64:
            value = coerceUInt64(value);
            break;
        case DataType.Int64:
            value = coerceInt64(value);
            break;
        case DataType.ExtensionObject:
            break;
        case DataType.DateTime:
            assert(value === null || value instanceof Date);
            break;
        case DataType.String:
            assert(typeof value === "string" || value === null);
            break;
        case DataType.ByteString:
            value = typeof value === "string" ? Buffer.from(value) : value;

            // istanbul ignore next
            if (!(value === null || value instanceof Buffer)) {
                throw new Error("ByteString should be null or a Buffer");
            }
            assert(value === null || value instanceof Buffer);
            break;
        default:
            assert(dataType !== undefined && dataType !== null, "Invalid DataType");
            break;
        case DataType.NodeId:
            break;
    }
    return value;
}

function isValidScalarVariant(dataType: DataType, value: any): boolean {
    assert(
        value === null ||
            DataType.Int64 === dataType ||
            DataType.ByteString === dataType ||
            DataType.UInt64 === dataType ||
            !(value instanceof Array)
    );
    assert(value === null || !(value instanceof Int32Array));
    assert(value === null || !(value instanceof Uint32Array));
    switch (dataType) {
        case DataType.NodeId:
            return isValidNodeId(value);
        case DataType.String:
            return typeof value === "string" || utils.isNullOrUndefined(value);
        case DataType.Int64:
            return isValidInt64(value);
        case DataType.UInt64:
            return isValidUInt64(value);
        case DataType.UInt32:
            return isValidUInt32(value);
        case DataType.Int32:
            return isValidInt32(value);
        case DataType.UInt16:
            return isValidUInt16(value);
        case DataType.Int16:
            return isValidInt16(value);
        case DataType.Byte:
            return isValidUInt8(value);
        case DataType.SByte:
            return isValidInt8(value);
        case DataType.Boolean:
            return isValidBoolean(value);
        case DataType.ByteString:
            return isValidByteString(value);
        default:
            return true;
    }
}

function isValidArrayVariant(dataType: DataType, value: any): boolean {
    if (value === null) {
        return true;
    }
    if (dataType === DataType.Float && value instanceof Float32Array) {
        return true;
    } else if (dataType === DataType.Double && value instanceof Float64Array) {
        return true;
    } else if (dataType === DataType.SByte && value instanceof Int8Array) {
        return true;
    } else if (dataType === DataType.Byte && (value instanceof Buffer || value instanceof Uint8Array)) {
        return true;
    } else if (dataType === DataType.Int16 && value instanceof Int16Array) {
        return true;
    } else if (dataType === DataType.Int32 && value instanceof Int32Array) {
        return true;
    } else if (dataType === DataType.UInt16 && value instanceof Uint16Array) {
        return true;
    } else if (dataType === DataType.UInt32 && value instanceof Uint32Array) {
        return true;
    }
    // array values can be store in Buffer, Float32Array
    assert(Array.isArray(value));
    for (const valueItem of value) {
        if (!isValidScalarVariant(dataType, valueItem)) {
            return false;
        }
    }
    return true;
}

/*istanbul ignore next*/
function isValidMatrixVariant(dataType: DataType, value: any, dimensions: number[] | null) {
    if (!dimensions) {
        return false;
    }
    if (!isValidArrayVariant(dataType, value)) {
        return false;
    }
    return true;
}

export function isValidVariant(
    arrayType: VariantArrayType,
    dataType: DataType,
    value: unknown,
    dimensions?: number[] | null
): boolean {
    switch (arrayType) {
        case VariantArrayType.Scalar:
            return isValidScalarVariant(dataType, value);
        case VariantArrayType.Array:
            return isValidArrayVariant(dataType, value);
        default:
            assert(arrayType === VariantArrayType.Matrix);
            return isValidMatrixVariant(dataType, value, dimensions!);
    }
}

export function buildVariantArray(
    dataType: DataType,
    nbElements: number,
    defaultValue: unknown
): Float32Array | Float64Array | Uint32Array | Int32Array | Uint16Array | Int16Array | Uint8Array | Int8Array | Array<unknown> {
    let value;
    switch (dataType) {
        case DataType.Float:
            value = new Float32Array(nbElements);
            break;
        case DataType.Double:
            value = new Float64Array(nbElements);
            break;
        case DataType.UInt32:
            value = new Uint32Array(nbElements);
            break;
        case DataType.Int32:
            value = new Int32Array(nbElements);
            break;
        case DataType.UInt16:
            value = new Uint16Array(nbElements);
            break;
        case DataType.Int16:
            value = new Int16Array(nbElements);
            break;
        case DataType.Byte:
            value = new Uint8Array(nbElements);
            break;
        case DataType.SByte:
            value = new Int8Array(nbElements);
            break;
        default:
            value = new Array(nbElements);
    }
    if (defaultValue !== undefined) {
        for (let i = 0; i < nbElements; i++) {
            value[i] = defaultValue;
        }
    }
    return value;
}

// old version of nodejs do not provide a Buffer#equals test
const oldNodeVersion =
    typeof process === "object" && process.versions && process.versions.node && process.versions.node.substring(0, 1) === "0";

function __type(a: any): string {
    return Object.prototype.toString.call(a);
}
function __check_same_object(o1: any, o2: any): boolean {
    if (o1 === o2) return true;
    if ((!o1 && o2) || (!o2 && o1)) return false;
    const t1 = __type(o1);
    const t2 = __type(o2);
    if (t1 !== t2) return false;
    switch (t1) {
        case "[object Array]":
            return __check_same_array(o1, o2);
        case "[object Object]": {
            if (o1.constructor?.name !== o2.constructor?.name) {
                return false;
            }
            const keys1 = Object.keys(o1);
            const keys2 = Object.keys(o2);
            // istanbul ignore next
            if (keys1.length !== keys2.length) {
                return false;
            }
            for (const k of Object.keys(o1)) {
                if (!__check_same_object(o1[k], o2[k])) {
                    return false;
                }
            }
            return true;
        }
        case "[object Float32Array]":
        case "[object Float64Array]":
        case "[object Int32Array]":
        case "[object Int16Array]":
        case "[object Int8Array]":
        case "[object Uint32Array]":
        case "[object Uint16Array]":
        case "[object Uint8Array]": {
            const b1 = Buffer.from(o1.buffer, o1.byteOffset, o1.byteLength);
            const b2 = Buffer.from(o2.buffer, o2.byteOffset, o2.byteLength);
            return b1.equals(b2);
        }
        default:
            return o1 === o2;
    }
}
function __check_same_array(arr1: any, arr2: any) {
    if (!arr1 || !arr2) {
        return !arr1 && !arr2;
    }
    if (arr1.length !== arr2.length) {
        return false;
    }
    if (arr1.length === 0 && 0 === arr2.length) {
        return true;
    }
    if (!oldNodeVersion && arr1.buffer) {
        // v1 and v2 are TypedArray (such as Int32Array...)
        // this is the most efficient way to compare 2 buffers but it doesn't work with node <= 0.12
        assert(arr2.buffer && __type(arr2.buffer) === "[object ArrayBuffer]");
        // compare byte by byte
        const b1 = Buffer.from(arr1.buffer, arr1.byteOffset, arr1.byteLength);
        const b2 = Buffer.from(arr2.buffer, arr2.byteOffset, arr2.byteLength);
        return b1.equals(b2);
    }
    const n = arr1.length;
    for (let i = 0; i < n; i++) {
        if (!__check_same_object(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;
}

/***
 *  returns true if the two variant represent the same value
 * @param v1 the first variant to compare
 * @param v2  the variant to compare with
 */
export function sameVariant(v1: Variant, v2: Variant): boolean {
    if (v1 === v2) {
        return true;
    }
    if ((!v1 && v2) || (v1 && !v2)) {
        return false;
    }
    if (v1.arrayType !== v2.arrayType) {
        return false;
    }
    if (v1.dataType !== v2.dataType) {
        return false;
    }
    if (v1.value === v2.value) {
        return true;
    }
    if (v1.arrayType === VariantArrayType.Scalar) {
        if (v1.dataType === DataType.ExtensionObject) {
            // compare two extension objects
            return __check_same_object(v1.value, v2.value);
        }
        if (Array.isArray(v1.value) && Array.isArray(v2.value)) {
            return __check_same_array(v1.value, v2.value);
        }
        if (Buffer.isBuffer(v1.value) && Buffer.isBuffer(v2.value)) {
            return v1.value.equals(v2.value);
        }
    }
    if (v1.arrayType === VariantArrayType.Array) {
        return __check_same_array(v1.value, v2.value);
    } else if (v1.arrayType === VariantArrayType.Matrix) {
        if (!__check_same_array(v1.dimensions, v2.dimensions)) {
            return false;
        }
        return __check_same_array(v1.value, v2.value);
    }
    return false;
}

// ---------------------------------------------------------------------------------------------------------
registerSpecialVariantEncoder(Variant);

export interface VariantOptionsT<T, DT extends DataType> extends VariantOptions {
    dataType: DT;
    arrayType?: VariantArrayType | string;
    value: T;
    dimensions?: number[] | null;
}

export interface VariantT<T, DT extends DataType> extends Variant {
    value: T;
    dataType: DT;
}
export declare type VariantByteString = VariantT<Buffer, DataType.ByteString>;
export declare type VariantDouble = VariantT<number, DataType.Double>;

registerType({
    name: "Variant",
    subType: "",

    coerce: _coerceVariant,

    encode: encodeVariant,

    decode: decodeVariant
});
