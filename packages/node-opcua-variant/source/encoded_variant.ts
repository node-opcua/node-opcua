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
 */
import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import type { DataType } from "./DataType_enum.js";
import { VariantArrayType } from "./VariantArrayType_enum.js";
import { decodeVariant, Variant } from "./variant.js";

const ARRAY_VALUES = 0x80;
const ARRAY_DIMENSIONS = 0x40;
const TYPE_MASK = 0x3f;
const FIELDS = ["dataType", "arrayType", "value", "dimensions"] as const;
type Field = (typeof FIELDS)[number];

export class EncodedVariant extends Variant {
    // null once the value was written: the Variant encodes its fields again
    #bytes: Uint8Array | null;
    #decoded: Variant | null = null;

    /** `bytes`: the binary encoding of one Variant, owned by this object from now on */
    constructor(bytes: Uint8Array) {
        super(null);
        this.#bytes = bytes;
        const mask = bytes[0];
        const dataType = (mask & TYPE_MASK) as DataType;
        const arrayType =
            (mask & ARRAY_VALUES) === 0
                ? VariantArrayType.Scalar
                : (mask & ARRAY_DIMENSIONS) !== 0
                  ? VariantArrayType.Matrix
                  : VariantArrayType.Array;
        // own accessors: the fields of Variant are own data properties, which would hide accessors of the prototype
        const read: Record<Field, () => unknown> = {
            dataType: () => dataType,
            arrayType: () => arrayType,
            value: () => this.#full().value,
            dimensions: () => this.#full().dimensions
        };
        for (const field of FIELDS) {
            Object.defineProperty(this, field, {
                get: read[field],
                set: (v: unknown) => this.#detach(field, v),
                enumerable: true,
                configurable: true
            });
        }
    }

    /** the encoding as it is, or null once the Variant was changed */
    public get encoded(): Uint8Array | null {
        return this.#bytes;
    }

    public override encode(stream: OutputBinaryStream): void {
        const bytes = this.#bytes;
        if (bytes) {
            stream.writeArrayBuffer(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
            return;
        }
        super.encode(stream);
    }

    #full(): Variant {
        if (!this.#decoded) {
            const bytes = this.#bytes as Uint8Array;
            // decoded from a copy: a typed array must not alias the bytes it came from
            this.#decoded = decodeVariant(new BinaryStream(Buffer.from(bytes)));
        }
        return this.#decoded;
    }

    /** a field written: the Variant holds plain fields from now on */
    #detach(field: Field, v: unknown): void {
        const full = this.#full();
        this.#bytes = null;
        for (const f of FIELDS) {
            Object.defineProperty(this, f, { value: full[f], writable: true, enumerable: true, configurable: true });
        }
        (this as unknown as Record<string, unknown>)[field] = v; // check-proto-pollution: ok - field is one of FIELDS
    }
}
