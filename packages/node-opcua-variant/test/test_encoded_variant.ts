import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { LocalizedText } from "node-opcua-data-model";
import should from "should";
import { DataType, decodeVariant, encodedVariant, encodeVariant, sameVariant, Variant, VariantArrayType } from "../dist/index.js";

function bytesOf(variant: Variant): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    variant.encode(size);
    const stream = new BinaryStream(size.length);
    variant.encode(stream);
    should(stream.length).eql(size.length);
    return new Uint8Array(stream.buffer.subarray(0, size.length));
}

const samples: [string, Variant][] = [
    ["a string", new Variant({ dataType: DataType.String, value: "centrifugal pump" })],
    [
        "a double array",
        new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array([1, 2.5, 3]) })
    ],
    [
        "a matrix",
        new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 2],
            value: new Int32Array([1, 2, 3, 4])
        })
    ],
    [
        "a localized text",
        new Variant({ dataType: DataType.LocalizedText, value: new LocalizedText({ text: "pump", locale: "en" }) })
    ],
    ["a string array", new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["a", "b"] })]
];

describe("encodedVariant: a Variant kept as its binary encoding", () => {
    for (const [name, variant] of samples) {
        it(`writes ${name} unchanged, and reads it as the Variant it encodes`, () => {
            const bytes = bytesOf(variant);
            const island = encodedVariant(bytes.slice());
            should(island.dataType).eql(variant.dataType);
            should(island.arrayType).eql(variant.arrayType);
            should(Buffer.from(bytesOf(island)).equals(Buffer.from(bytes))).eql(true);
            should(sameVariant(island, variant)).eql(true);
            should(sameVariant(decodeVariant(new BinaryStream(Buffer.from(bytesOf(island)))), variant)).eql(true);
            if (variant.arrayType === VariantArrayType.Matrix) {
                should(island.dimensions).eql(variant.dimensions);
            }
        });
    }

    it("does not decode to tell its DataType", () => {
        const bytes = bytesOf(samples[0][1]);
        const island = encodedVariant(bytes);
        // garbage after the first byte: only a read of the value would notice
        bytes.fill(0xff, 1);
        should(island.dataType).eql(DataType.String);
        should(island.arrayType).eql(VariantArrayType.Scalar);
    });

    it("gives a decoded array that does not alias its bytes", () => {
        const bytes = bytesOf(samples[1][1]);
        const island = encodedVariant(bytes);
        (island.value as Float64Array)[0] = 99;
        should(Buffer.from(bytesOf(encodedVariant(bytes.slice()))).equals(Buffer.from(bytesOf(samples[1][1])))).eql(true);
    });

    it("is encoded from its fields once one of them is written", () => {
        const island = encodedVariant(bytesOf(samples[0][1]));
        island.value = "valve";
        should(island.encoded).eql(null);
        const decoded = decodeVariant(new BinaryStream(Buffer.from(bytesOf(island))));
        should(decoded.value).eql("valve");
        should(decoded.dataType).eql(DataType.String);
        const retyped = encodedVariant(bytesOf(samples[0][1]));
        retyped.dataType = DataType.ByteString;
        retyped.value = Buffer.from("x");
        should(decodeVariant(new BinaryStream(Buffer.from(bytesOf(retyped)))).dataType).eql(DataType.ByteString);
    });

    it("is encoded by encodeVariant like any Variant", () => {
        const bytes = bytesOf(samples[3][1]);
        const stream = new BinaryStream(bytes.length);
        encodeVariant(encodedVariant(bytes.slice()), stream);
        should(Buffer.from(stream.buffer.subarray(0, bytes.length)).equals(Buffer.from(bytes))).eql(true);
    });
});
