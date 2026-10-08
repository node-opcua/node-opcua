/**
 * @module node-opcua-variant
 *
 * A Variant kept as its binary encoding: written to a stream as it is, decoded only if its value is
 * read. What a server serves from a store of encoded values (the shared heap of a compact address
 * space) without decoding and encoding each value again: the bytes go into the response unchanged.
 *
 * The first byte of the encoding gives the DataType and the array flags, so that what looks at
 * `dataType` or `arrayType` (the encoding mask of a DataValue, for one) does not decode. Reading
 * `value` or `dimensions` decodes once; writing any of the four fields detaches the Variant from its
 * bytes, and it is then encoded like any other.
 *
 * Made by encodedVariant(), never by its constructor: the constructor of Variant defines the four
 * fields on the instance itself, hiding the accessors of the prototype, and accessors defined per
 * instance cost several times what decoding a short string does.
 */
import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import type { DataType } from "./DataType_enum.js";
import { VariantArrayType } from "./VariantArrayType_enum.js";
import { decodeVariant, Variant } from "./variant.js";

const ARRAY_VALUES = 0x80;
const ARRAY_DIMENSIONS = 0x40;
const TYPE_MASK = 0x3f;

export class EncodedVariant extends Variant {
    /** the encoding; null once a field was written, the Variant then encoding its fields */
    declare _bytes: Uint8Array | null;
    /** the Variant the bytes decode to, once a field other than dataType and arrayType was read */
    declare _decoded: Variant | null;

    private constructor() {
        super(null);
    }

    /** the encoding as it is, or null once the Variant was changed */
    public override get encoded(): Uint8Array | null {
        return this._bytes;
    }

    /** a copy that is still these bytes: the encoding is never changed in place, a write detaches it */
    public override clone(): Variant {
        return this._bytes ? encodedVariant(this._bytes) : (this._decoded as Variant).clone();
    }

    public override encode(stream: OutputBinaryStream): void {
        const bytes = this._bytes;
        if (bytes) {
            stream.writeArrayBuffer(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
            return;
        }
        (this._decoded as Variant).encode(stream);
    }
}

function decodedOf(variant: EncodedVariant): Variant {
    if (!variant._decoded) {
        const bytes = variant._bytes as Uint8Array;
        // decoded from a copy: a typed array must not alias the bytes it came from
        variant._decoded = decodeVariant(new BinaryStream(Buffer.from(bytes)));
    }
    return variant._decoded;
}

function arrayTypeOf(mask: number): VariantArrayType {
    if ((mask & ARRAY_VALUES) === 0) return VariantArrayType.Scalar;
    return (mask & ARRAY_DIMENSIONS) !== 0 ? VariantArrayType.Matrix : VariantArrayType.Array;
}

// the four fields of an EncodedVariant, once on the prototype: from the first byte, or the decoded Variant
const read = {
    dataType: (v: EncodedVariant) => (v._bytes ? ((v._bytes[0] & TYPE_MASK) as DataType) : decodedOf(v).dataType),
    arrayType: (v: EncodedVariant) => (v._bytes ? arrayTypeOf(v._bytes[0]) : decodedOf(v).arrayType),
    value: (v: EncodedVariant) => decodedOf(v).value,
    dimensions: (v: EncodedVariant) => decodedOf(v).dimensions
};
for (const field of ["dataType", "arrayType", "value", "dimensions"] as const) {
    Object.defineProperty(EncodedVariant.prototype, field, {
        get(this: EncodedVariant) {
            return read[field](this);
        },
        set(this: EncodedVariant, value: unknown) {
            // written: the Variant holds its fields from now on, the bytes no longer tell them
            const decoded = decodedOf(this);
            this._bytes = null;
            (decoded as unknown as Record<string, unknown>)[field] = value; // check-proto-pollution: ok - field is one of the four Variant fields of the literal list above
        },
        configurable: true,
        enumerable: true
    });
}

/** a Variant for the binary encoding of one Variant (`bytes`, owned by it from now on), decoded only if its value is read */
export function encodedVariant(bytes: Uint8Array): EncodedVariant {
    const variant = Object.create(EncodedVariant.prototype) as EncodedVariant;
    variant._bytes = bytes;
    variant._decoded = null;
    return variant;
}
