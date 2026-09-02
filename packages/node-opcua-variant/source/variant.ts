/**
 * @module node-opcua-variant
 */
import { assert } from "node-opcua-assert";
import {
    coerceInt64,
    coerceUInt64,
    decodeUInt8,
    decodeUInt32,
    encodeUInt8,
    encodeUInt32,
    isValidBoolean,
    isValidByteString,
    isValidInt8,
    isValidInt16,
    isValidInt32,
    isValidInt64,
    isValidNodeId,
    isValidUInt8,
    isValidUInt16,
    isValidUInt32,
    isValidUInt64
} from "node-opcua-basic-types";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import {
    BaseUAObject,
    buildStructuredType,
    type DecodeDebugOptions,
    FieldCategory,
    findBuiltInType,
    initialize_field,
    onBuiltInTypeRegistryChanged,
    registerSpecialVariantEncoder,
    registerType
} from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { isNullOrUndefined } from "node-opcua-utils";
import { DataType } from "./DataType_enum.js";
import { VariantArrayType } from "./VariantArrayType_enum.js";

export { VariantArrayType };

const warningLog = make_warningLog("variant");

const schemaVariant = buildStructuredType({
    baseType: "BaseUAObject",
    category: FieldCategory.basic,
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

/**
 * copy one element of a Variant deeply enough that writing the original cannot be seen
 * through the copy.
 *
 * Only the DataTypes whose values are mutable objects need work here. Numbers, strings and
 * booleans are immutable, and a StatusCode is a shared constant, so they are returned
 * as-is. Everything else is a live object that a server may well write in place - the
 * address space does exactly that with a bound ExtensionObject - and sharing it would let
 * a later write rewrite a sample that has already been recorded and queued.
 */
function cloneVariantElement(dataType: DataType, value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    switch (dataType) {
        case DataType.ByteString:
            return Buffer.isBuffer(value) ? Buffer.from(value as Buffer) : value;
        case DataType.DateTime: {
            if (!(value instanceof Date)) {
                return value;
            }
            const copy = new Date(value.getTime());
            // node-opcua carries sub-millisecond precision as a `picoseconds` property
            // hung on the Date instance itself, so a plain new Date(getTime()) silently
            // drops it - the historical-access nodes compare on it.
            const picoseconds = (value as Date & { picoseconds?: number }).picoseconds;
            if (picoseconds !== undefined) {
                (copy as Date & { picoseconds?: number }).picoseconds = picoseconds;
            }
            return copy;
        }
        case DataType.NodeId:
        case DataType.ExpandedNodeId: {
            const nodeId = value as NodeId;
            if (!(nodeId instanceof NodeId)) {
                return value;
            }
            // a ByteString identifier is itself a Buffer and needs copying too
            const identifier = Buffer.isBuffer(nodeId.value) ? Buffer.from(nodeId.value) : nodeId.value;
            return new NodeId(nodeId.identifierType, identifier, nodeId.namespace);
        }
        // LocalizedText and QualifiedName are copied field by field rather than through
        // their option constructors: those default with `options.text || null`, so an
        // empty string - a perfectly valid value, and what an uncommented Condition
        // carries - would come back as null.
        case DataType.LocalizedText: {
            if (!(value instanceof LocalizedText)) {
                return value;
            }
            const localizedText = new LocalizedText(null);
            localizedText.locale = value.locale;
            localizedText.text = value.text;
            return localizedText;
        }
        case DataType.QualifiedName: {
            if (!(value instanceof QualifiedName)) {
                return value;
            }
            const qualifiedName = new QualifiedName(null);
            qualifiedName.namespaceIndex = value.namespaceIndex;
            qualifiedName.name = value.name;
            return qualifiedName;
        }
        case DataType.Variant:
            return value instanceof Variant ? value.clone() : value;
        case DataType.ExtensionObject: {
            const extensionObject = value as { constructor: new (options: unknown) => unknown };
            return extensionObject?.constructor ? new extensionObject.constructor(value) : value;
        }
        default:
            // Boolean, the integer and floating point families, String, Guid, StatusCode:
            // immutable values, nothing to copy
            return value;
    }
}

/** deep-copy the payload of a Variant, preserving its shape (scalar, typed array or array) */
function cloneVariantValue(dataType: DataType, value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    // a Buffer is both a typed array and the representation of a scalar ByteString, so it
    // has to be tested before the generic typed-array branch below
    if (Buffer.isBuffer(value)) {
        return Buffer.from(value);
    }
    if (ArrayBuffer.isView(value)) {
        // Float64Array and friends: copy the elements, never the view onto the source
        const typed = value as unknown as BufferedArray2;
        const copy = new (typed.constructor as BufferedArrayConstructor)(typed.length);
        copy.set(typed as never);
        return copy;
    }
    if (Array.isArray(value)) {
        if (!hasMutableElements(dataType)) {
            // strings, numbers, booleans: the elements need no copy, only the array does; an
            // element-by-element walk here cost a million-string variable 150ms per read
            return value.slice();
        }
        const n = value.length;
        const copy = new Array(n);
        for (let i = 0; i < n; i++) {
            copy[i] = cloneVariantElement(dataType, value[i]);
        }
        return copy;
    }
    return cloneVariantElement(dataType, value);
}

/** the data types whose elements cloneVariantElement copies rather than returns as they are */
function hasMutableElements(dataType: DataType): boolean {
    switch (dataType) {
        case DataType.ByteString:
        case DataType.DateTime:
        case DataType.NodeId:
        case DataType.ExpandedNodeId:
        case DataType.LocalizedText:
        case DataType.QualifiedName:
        case DataType.Variant:
        case DataType.ExtensionObject:
            return true;
        default:
            return false;
    }
}

function _coerceVariant(variantLike: VariantOptions | Variant): Variant {
    const value = variantLike instanceof Variant ? variantLike : new Variant(variantLike);
    return value;
}

export interface VariantOptions {
    dataType?: DataType | string;
    arrayType?: VariantArrayType | string;
    // biome-ignore lint/suspicious/noExplicitAny: intentionally using any here
    value?: any;
    dimensions?: number[] | null;
}

export interface VariantOptions2 {
    dataType: DataType;
    arrayType: VariantArrayType;
    // biome-ignore lint/suspicious/noExplicitAny: intentionally using any here
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
    // biome-ignore lint/suspicious/noExplicitAny: intentionally using any here
    public value: any;
    public dimensions: number[] | null;

    constructor(options?: VariantOptions | null) {
        super();

        // `new Variant()` and `new Variant(null)` describe the same empty variant, so both
        // take the cheap branch. The general path below would reach the identical field
        // values via constructHook({}) + initialize_field, at ~12x the cost - which the
        // decoders pay on every value, since they overwrite these fields immediately.
        if (options === null || options === undefined) {
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
                /* c8 ignore start */
                if (this.value && !(this.value instanceof BaseUAObject)) {
                    throw new Error(
                        `A variant with DataType.ExtensionObject must have a ExtensionObject value.\nMake sure that you specify a valid ExtensionObject to the value options in the Variant Constructor`
                    );
                }
                /* c8 ignore stop */
            } else {
                if (this.value) {
                    /* c8 ignore start */
                    for (const e of this.value) {
                        if (e && !(e instanceof BaseUAObject)) {
                            throw new Error(
                                "A variant with DataType.ExtensionObject must have a ExtensionObject value\nMake sure that you specify a valid ExtensionObject for all element of the value array passed to the  Variant Constructor`"
                            );
                        }
                    }
                    /* c8 ignore stop */
                }
            }
        }
    }
    public encode(stream: OutputBinaryStream): void {
        encodeVariant(this, stream);
    }

    public decode(stream: BinaryStream): void {
        // A Variant can hold an ExtensionObject whose body holds another Variant, so the
        // value graph can nest without the message growing. Count each Variant level
        // against the shared budget so a deep chain cannot exhaust the stack (Part 6
        // §5.1.9).
        stream.enterNestingLevel();
        try {
            internalDecodeVariant(this, stream);
        } finally {
            stream.exitNestingLevel();
        }
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
        const variant = new Variant(null);
        variant.dataType = this.dataType;
        variant.arrayType = this.arrayType;
        variant.dimensions = this.dimensions ? this.dimensions.slice() : null;
        variant.value = cloneVariantValue(this.dataType, this.value);
        return variant;
    }
}

Variant.prototype.schema = schemaVariant;

export type VariantLike = VariantOptions;

function variantToString(self: Variant, _options?: Record<string, unknown>) {
    function asString(value: unknown): string {
        switch (self.dataType) {
            case DataType.ByteString:
                return value ? `0x${(value as Buffer).toString("hex")}` : "<null>";
            case DataType.NodeId:
                return value instanceof NodeId ? value.displayText() : value ? String(value) : "";
            case DataType.Boolean:
                return String(value);
            case DataType.DateTime:
                return value
                    ? typeof (value as Date).toISOString === "function"
                        ? (value as Date).toISOString()
                        : String(value)
                    : "<null>";
            default:
                return value ? String(value) : "0";
        }
    }

    function f(value: unknown) {
        if (value === undefined || (value === null && typeof value === "object")) {
            return "<null>";
        }
        return asString(value);
    }

    let data = VariantArrayType[self.arrayType];

    if (self.dimensions && self.dimensions.length >= 0) {
        data += `[ ${self.dimensions.join(",")} ]`;
    }

    data += `<${DataType[self.dataType]}>`;
    if (self.arrayType === VariantArrayType.Scalar) {
        data += `, value: ${f(self.value)}`;
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
            data += `, l= ${self.value.length}, value=[${a.map(f).join(",")}]`;
        }
    }
    return `Variant(${data})`;
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
    if (!variant) {
        variant = nullVariant;
    }
    let encodingByte = variant.dataType;

    let dimensions = variant.dimensions;
    if (variant.arrayType === VariantArrayType.Matrix && dimensions && dimensions.length > 0) {
        // Defensive guard: an empty Matrix value (value.length === 0) combined with non-zero declared
        // dimensions would encode as a spec-violating wire form (ArraySize 0 followed by non-empty
        // ArrayDimensions whose product !== 0), which strict clients - including node-opcua's own
        // decoder - reject with "inconsistent matrix". Emit a self-consistent empty matrix instead.
        const valueLength = (variant.value as ArrayLike<unknown> | null | undefined)?.length ?? 0;
        if (valueLength === 0) {
            dimensions = [];
        }
    }

    if (variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix) {
        encodingByte |= VARIANT_ARRAY_MASK;
    }
    if (dimensions && variant.arrayType === VariantArrayType.Matrix) {
        assert(dimensions.length >= 0);
        encodingByte |= VARIANT_ARRAY_DIMENSIONS_MASK;
    }
    encodeUInt8(encodingByte, stream);

    if (variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix) {
        encodeVariantArray(variant.dataType, stream, variant.value);
    } else {
        const encode = get_encoder(variant.dataType || DataType.Null);
        encode(variant.value, stream);
    }

    if ((encodingByte & VARIANT_ARRAY_DIMENSIONS_MASK) === VARIANT_ARRAY_DIMENSIONS_MASK && dimensions) {
        encodeDimension(dimensions, stream);
    }
}

/* c8 ignore start */
function _decodeVariantArrayDebug(
    stream: BinaryStream,
    decode: (stream: BinaryStream) => unknown,
    tracer: { trace: (...args: unknown[]) => void; dump: (...args: unknown[]) => void },
    dataType: DataType
) {
    let cursorBefore = stream.length;
    const length = decodeUInt32(stream);

    let i: number = 0;
    let element: unknown;
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

    /* c8 ignore next */
    if (!decode) {
        throw new Error(`Variant.decode : cannot find decoder for type ${DataType[self.dataType]}`);
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
        const _verification = calculate_product(self.dimensions);
    }
}
/* c8 ignore stop */
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
        /* c8 ignore start */
        if (verification !== self.value.length) {
            throw new Error("internalDecodeVariant: BadDecodingError: inconsistent matrix ");
        }
        /* c8 ignore stop */
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
                if (opts?.value?.constructor) {
                    opts.value = new opts.value.constructor(opts.value);
                }
            } else {
                if (opts.value) {
                    opts.value = opts.value.map((e: { constructor: new (e: unknown) => unknown } | null) => {
                        if (e?.constructor) {
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
        /* c8 ignore start */
        if (!d) {
            throw new Error(`Cannot find Built-In data type or any DataType resolving to ${options.dataType}`);
        }
        /* c8 ignore stop */
        options.dataType = DataType[d.name as keyof typeof DataType];
    }

    // array type could be a string
    if (typeof options.arrayType === "string") {
        const at: VariantArrayType | undefined = (VariantArrayType as unknown as Record<string, VariantArrayType | undefined>)[
            options.arrayType
        ];
        /* c8 ignore start */
        if (at === undefined) {
            throw new Error(`ArrayType: invalid ${options.arrayType}`);
        }
        /* c8 ignore stop */
        options.arrayType = at;
    }

    if (isArrayTypeUnspecified && Array.isArray(options.value)) {
        // when using UInt64 ou Int64 arrayType must be specified , as automatic detection cannot be made

        /* c8 ignore start */
        if (options.dataType === DataType.UInt64 || options.dataType === DataType.Int64) {
            // we do nothing here ....
            throw new Error(
                "Variant#constructor : when using UInt64 ou Int64" +
                    " arrayType must be specified , as automatic detection cannot be made"
            );
        } else {
            /* c8 ignore stop */
            options.arrayType = VariantArrayType.Array;
            isArrayTypeUnspecified = false;
        }
    }

    if (options.arrayType !== VariantArrayType.Scalar && !isArrayTypeUnspecified) {
        assert(options.arrayType === VariantArrayType.Array || options.arrayType === VariantArrayType.Matrix);
        if (options.arrayType === VariantArrayType.Array) {
            const value1 = coerceVariantArray(options.dataType, options.value);
            assert(value1 === null || value1 !== options.value);
            options.value = value1;
        } else {
            /* c8 ignore start */
            assert(options.arrayType === VariantArrayType.Matrix);
            options.value = options.value || [];

            options.value = coerceVariantArray(options.dataType, options.value);

            if (!options.dimensions) {
                throw new Error("Matrix Variant : missing dimensions");
            }
            if (options.value.length !== 0 && options.value.length !== calculate_product(options.dimensions)) {
                throw new Error(
                    `Matrix Variant : invalid value size = options.value.length ${options.value.length} != ${calculate_product(options.dimensions)} => ${JSON.stringify(options.dimensions)}`
                );
            }
        }
        /* c8 ignore stop */
    } else {
        assert(options.arrayType === VariantArrayType.Scalar || options.arrayType === undefined);
        options.arrayType = VariantArrayType.Scalar;
        const _tmp = options.value;
        // scalar
        options.value = coerceVariantType(options.dataType, options.value);

        /* c8 ignore start */
        if (!isValidVariant(options.arrayType, options.dataType, options.value, null)) {
            throw new Error(
                `Invalid variant arrayType: ${VariantArrayType[options.arrayType]}  dataType: ${DataType[options.dataType]} value:${options.value} (javascript type = ${typeof options.value} )`
            );
        }
        /* c8 ignore stop */
    }
    if (options.dimensions) {
        assert(options.arrayType === VariantArrayType.Matrix, "dimension can only provided if variant is a matrix");
    }
    return options as VariantOptions2;
}

function calculate_product(array: number[] | null): number {
    /* c8 ignore next */
    if (!array || array.length === 0) {
        return 0;
    }
    return array.reduce((n: number, p: number) => n * p, 1);
}

type VariantEncodeFunc = (value: unknown, stream: OutputBinaryStream) => void;
type VariantDecodeFunc = (stream: BinaryStream) => unknown;

// Resolving a codec used to cost a DataType[n] reverse-enum lookup, a recursive
// findBuiltInType, and two string-hash Map lookups - once per scalar Variant, on both
// encode and decode. These memoise that per numeric DataType.
//
// They must be filled lazily, not built up front: the built-in type registry is
// populated across package boundaries at module-eval time, and ExtensionObject,
// DataValue and Variant all register *after* this module's body runs. An eager table
// would throw at import, or silently cache undefined for the three hottest types.
//
// Sized to VARIANT_TYPE_MASK (0x3f), since a peer controls those bits on the wire.
const encoderTable: (VariantEncodeFunc | undefined)[] = new Array(64);
const decoderTable: (VariantDecodeFunc | undefined)[] = new Array(64);

// registerType/unregisterType are public API, so a memoised function can go stale.
onBuiltInTypeRegistryChanged(() => {
    encoderTable.fill(undefined);
    decoderTable.fill(undefined);
});

function get_encoder(dataType: DataType): VariantEncodeFunc {
    // Only consult the memo for a numeric DataType. Array indices are strings, so
    // encoderTable["11"] and encoderTable[11] are the same slot: a numeric-string
    // dataType would be silently served the cached codec for 11, where the resolution
    // path below correctly rejects it.
    if (typeof dataType === "number") {
        const cached = encoderTable[dataType];
        if (cached !== undefined) {
            return cached;
        }
    }
    // a hand-built Variant may carry a string dataType; the constructor normalises it,
    // so this is a fallback rather than a hot path, and it is deliberately not memoised.
    const dataTypeAsString = typeof dataType === "string" ? dataType : DataType[dataType];
    if (!dataTypeAsString) {
        throw new Error(`Variant.encode : invalid dataType ${dataType}`);
    }
    const encode = findBuiltInType(dataTypeAsString).encode;
    /* c8 ignore start */
    if (!encode) {
        throw new Error(`Cannot find encode function for dataType ${dataTypeAsString}`);
    }
    /* c8 ignore stop */
    if (typeof dataType === "number") {
        encoderTable[dataType] = encode;
    }
    return encode;
}

function get_decoder(dataType: DataType): VariantDecodeFunc {
    // same index-coercion hazard as get_encoder above
    if (typeof dataType === "number") {
        const cached = decoderTable[dataType];
        if (cached !== undefined) {
            return cached;
        }
    }
    const dataTypeAsString = DataType[dataType];
    // the wire carries 6 bits of DataType but only 0..25 are defined: reject the rest
    // with a real Error, so "bad input from the peer" stays distinguishable from a
    // TypeError raised by calling an undefined table entry.
    if (!dataTypeAsString) {
        throw new Error(`Variant.decode : cannot find decoder for type ${dataType}`);
    }
    const decode = findBuiltInType(dataTypeAsString).decode;
    /* c8 ignore start */
    if (!decode) {
        throw new Error(`Variant.decode : cannot find decoder for type ${dataTypeAsString}`);
    }
    /* c8 ignore stop */
    decoderTable[dataType] = decode;
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
    new (length: number): BufferedArray2;
    new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): BufferedArray2;
}

function convertTo(
    dataType: DataType,
    arrayTypeConstructor: BufferedArrayConstructor | null,
    value: BufferedArray2 | unknown[] | null
) {
    // c8 ignore next
    if (value === undefined || value === null) {
        return null;
    }

    if (arrayTypeConstructor && value instanceof arrayTypeConstructor) {
        if (value instanceof Buffer) {
            return Buffer.from(value); // preserve Buffer prototype
        }
        const newArray = new arrayTypeConstructor(value.length); // deep copy
        newArray.set(value);
        return newArray;
    }
    const coerceFunc = coerceVariantType.bind(null, dataType);
    const n = value.length;

    const newArr: BufferedArray2 | unknown[] = arrayTypeConstructor ? new arrayTypeConstructor(n) : new Array(n);
    for (let i = 0; i < n; i++) {
        newArr[i] = coerceFunc(value[i]);
    }
    // c8 ignore next
    if (arrayTypeConstructor && displayWarning && n > 10) {
        warningLog(`Warning ! an array containing  ${DataType[dataType]} elements has been provided as a generic array. `);
        warningLog(
            "          This is inefficient as every array value will have to be coerced and verified against the expected type"
        );
        warningLog(
            "          It is highly recommended that you use a  typed array ",
            arrayTypeConstructor.constructor.name,
            " instead"
        );
    }
    return newArr;
}

interface DataTypeHelper {
    coerce: (value: BufferedArray2 | unknown[] | null) => BufferedArray2 | unknown[] | null;
    encode: (stream: OutputBinaryStream, value: unknown) => void;
    decode: (stream: BinaryStream) => unknown;
}

// Indexed by the numeric DataType, so a lookup is a plain array load rather than a
// DataType[n] reverse-enum lookup followed by a string-keyed property access.
//
// Sized to VARIANT_TYPE_MASK (0x3f) rather than to the number of DataTypes: a peer
// controls those bits, so an out-of-range value must read an in-bounds hole instead
// of walking off the end into the prototype chain.
const typedArrayHelpers: DataTypeHelper[] = new Array(64);

function _getHelper(dataType: DataType): DataTypeHelper | undefined {
    // guard the index coercion described in get_encoder: a numeric-string dataType would
    // otherwise select a typed-array helper and silently encode down a different path
    if (typeof dataType !== "number") {
        return undefined;
    }
    return typedArrayHelpers[dataType];
}

function coerceVariantArray(dataType: DataType, value: BufferedArray2 | unknown[] | null) {
    const helper = _getHelper(dataType);
    if (helper) {
        return helper.coerce(value);
    } else {
        return convertTo(dataType, null, value);
    }
}

function encodeTypedArray(arrayTypeConstructor: BufferedArrayConstructor, stream: OutputBinaryStream, value: unknown) {
    const typedValue = value as BufferedArray2;
    assert(typedValue instanceof arrayTypeConstructor);
    assert(typedValue.buffer instanceof ArrayBuffer);
    encodeUInt32(typedValue.length, stream);
    stream.writeArrayBuffer(typedValue.buffer as ArrayBuffer, typedValue.byteOffset, typedValue.byteLength);
}

function encodeGeneralArray(dataType: DataType, stream: OutputBinaryStream, value: unknown[] | null) {
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

function encodeVariantArray(dataType: DataType, stream: OutputBinaryStream, value: BufferedArray2 | unknown[] | null) {
    if (value && (value as BufferedArray2).buffer) {
        const helper = _getHelper(dataType);
        // previously an undefined helper here surfaced as "cannot read properties of
        // undefined"; keep it a failure, but one that names the offending dataType
        if (!helper) {
            throw new Error(`Variant.encode : no typed-array encoder for dataType ${dataType}`);
        }
        return helper.encode(stream, value);
    }
    return encodeGeneralArray(dataType, stream, value as unknown[] | null);
}

function decodeTypedArray(arrayTypeConstructor: BufferedArrayConstructor, stream: BinaryStream) {
    const length = decodeUInt32(stream);

    /* c8 ignore next */
    if (length === 0xffffffff) {
        return null;
    }
    if (length > Variant.maxTypedArrayLength) {
        throw new Error(
            `maxTypedArrayLength(${Variant.maxTypedArrayLength}) has been exceeded in Variant.decodeArray (typed Array) len=${length}`
        );
    }
    const byteLength = length * arrayTypeConstructor.BYTES_PER_ELEMENT;
    const buffer = stream.readBuffer(byteLength);
    if (buffer.byteOffset % arrayTypeConstructor.BYTES_PER_ELEMENT === 0) {
        return new arrayTypeConstructor(buffer.buffer, buffer.byteOffset, length);
    }
    const copy = new Uint8Array(buffer);
    return new arrayTypeConstructor(copy.buffer, copy.byteOffset, length);
}

function decodeGeneralArray(dataType: DataType, stream: BinaryStream) {
    const length = decodeUInt32(stream);

    /* c8 ignore next */
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

function _declareTypeArrayHelper(dataType: DataType, typedArrayConstructor: BufferedArrayConstructor) {
    typedArrayHelpers[dataType] = {
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

function decodeDimension(stream: BinaryStream): number[] | null {
    return decodeGeneralArray(DataType.UInt32, stream) as number[] | null;
}

function encodeDimension(dimensions: number[], stream: OutputBinaryStream) {
    return encodeGeneralArray(DataType.UInt32, stream, dimensions);
}

function isEnumerationItem(value: unknown): boolean {
    return (
        value instanceof Object &&
        Object.hasOwn(value, "value") &&
        Object.hasOwn(value, "key") &&
        value.constructor.name === "EnumValueType"
    );
}

// biome-ignore lint/suspicious/noExplicitAny: intentional
export function coerceVariantType(dataType: DataType, value: undefined | any): any {
    /* eslint max-statements: ["error",1000], complexity: ["error",1000]*/
    if (value === undefined) {
        value = null;
    }
    /* c8 ignore start */
    if (isEnumerationItem(value)) {
        // OPCUA Specification 1.0.3 5.8.2 encoding rules for various dataType:
        // [...]Enumeration are always encoded as Int32 on the wire [...]

        if (dataType !== DataType.Int32 && dataType !== DataType.ExtensionObject) {
            throw new Error(`expecting DataType.Int32 for enumeration values ; got DataType.${dataType.toString()} instead`);
        }
    }
    /* c8 ignore stop */

    switch (dataType) {
        case DataType.Null:
            value = null;
            break;

        case DataType.LocalizedText:
            if (!value?.schema || value.schema !== LocalizedText.schema) {
                value = new LocalizedText(value);
            }
            break;

        case DataType.QualifiedName:
            if (!value?.schema || value.schema !== QualifiedName.schema) {
                value = new QualifiedName(value);
            }
            break;
        case DataType.Int32:
        case DataType.Int16:
        case DataType.UInt32:
        case DataType.UInt16:
            assert(value !== undefined);
            value = parseInt(value, 10);
            /* c8 ignore start */
            if (!Number.isFinite(value)) {
                throw new Error(`expecting a number ${value}`);
            }
            /* c8 ignore stop */
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
            assert(value === null || !!value.getTime);
            break;
        case DataType.String:
            assert(typeof value === "string" || value === null);
            break;
        case DataType.ByteString:
            value = typeof value === "string" ? Buffer.from(value) : value;

            /* c8 ignore start */
            if (!(value === null || value instanceof Buffer)) {
                throw new Error("ByteString should be null or a Buffer");
            }
            /* c8 ignore stop */
            assert(value === null || value instanceof Buffer);
            break;
        default:
            assert(dataType !== undefined && dataType !== null, "Invalid DataType");
            break;
    }
    return value;
}

// biome-ignore lint/suspicious/noExplicitAny: intentionally using an   y here
function isValidScalarVariant(dataType: DataType, value: any): boolean {
    assert(
        value === null ||
            DataType.Int64 === dataType ||
            DataType.ByteString === dataType ||
            DataType.UInt64 === dataType ||
            !Array.isArray(value)
    );
    assert(value === null || !(value instanceof Int32Array));
    assert(value === null || !(value instanceof Uint32Array));
    switch (dataType) {
        case DataType.NodeId:
            return isValidNodeId(value);
        case DataType.String:
            return typeof value === "string" || isNullOrUndefined(value);
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

// biome-ignore lint/suspicious/noExplicitAny: intentional - polymorphic Variant value
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

/* c8 ignore start */
// biome-ignore lint/suspicious/noExplicitAny: intentional - polymorphic Variant value
function isValidMatrixVariant(dataType: DataType, value: any, dimensions: number[] | null) {
    if (!dimensions) {
        return false;
    }
    if (!isValidArrayVariant(dataType, value)) {
        return false;
    }
    return true;
}
/* c8 ignore stop */

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
            return isValidMatrixVariant(dataType, value, dimensions ?? null);
    }
}

export function buildVariantArray(
    dataType: DataType,
    nbElements: number,
    defaultValue: unknown
): Float32Array | Float64Array | Uint32Array | Int32Array | Uint16Array | Int16Array | Uint8Array | Int8Array | Array<unknown> {
    let value:
        | Float32Array
        | Float64Array
        | Uint32Array
        | Int32Array
        | Uint16Array
        | Int16Array
        | Uint8Array
        | Int8Array
        | Array<unknown>;
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

// biome-ignore lint/suspicious/noExplicitAny: intentional - deep equality comparison of polymorphic values
function __type(a: any): string {
    return Object.prototype.toString.call(a);
}
// biome-ignore lint/suspicious/noExplicitAny: intentional - deep equality comparison of polymorphic values
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
            /* c8 ignore next */
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
        case "[object BigInt64Array]":
        case "[object BigUint64Array]":
        case "[object Uint8ClampedArray]":

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
        case "[object BigInt]":
            return o1 === o2;
        case "[object Date]":
            return o1.getTime() === o2.getTime();
        default:
            return o1 === o2;
    }
}
// biome-ignore lint/suspicious/noExplicitAny: intentional - deep equality comparison of polymorphic values
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
        // NodeId, LocalizedText, QualifiedName and DateTime are objects too, and without
        // this they fall through to `return false` below - two equal values would always
        // look different. That was masked as long as clone() shared the instance, so the
        // `v1.value === v2.value` shortcut above matched; it was already wrong for values
        // that arrive separately, such as anything just decoded off the wire.
        if (v1.value !== null && typeof v1.value === "object") {
            return __check_same_object(v1.value, v2.value);
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
