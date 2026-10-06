import { BinaryStream } from "node-opcua-binary-stream";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { DataType, Variant, VariantArrayType, type VariantOptions } from "../dist/index.js";

function encoded(variant: Variant): Buffer {
    const stream = new BinaryStream(1000);
    variant.encode(stream);
    return stream.buffer.subarray(0, stream.length);
}

describe("new Variant(variant)", () => {
    const scalars: VariantOptions[] = [
        { dataType: DataType.Null },
        { dataType: DataType.Boolean, value: true },
        { dataType: DataType.Double, value: 3.14 },
        { dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 2] },
        { dataType: DataType.String, value: "hello" },
        { dataType: DataType.ByteString, value: Buffer.from("abc") },
        { dataType: DataType.DateTime, value: new Date(2026, 9, 6) },
        { dataType: DataType.NodeId, value: coerceNodeId("ns=1;i=42") },
        { dataType: DataType.QualifiedName, value: new QualifiedName({ name: "q", namespaceIndex: 1 }) },
        { dataType: DataType.LocalizedText, value: new LocalizedText({ text: "t", locale: "en" }) },
        { dataType: DataType.StatusCode, value: StatusCodes.BadNotReadable }
    ];

    for (const options of scalars) {
        it(`copies a scalar ${DataType[options.dataType as DataType]} like the general constructor does`, () => {
            const source = new Variant(options);
            const copy = new Variant(source);
            const reference = new Variant({ ...options });

            should(copy).not.equal(source);
            should(copy.dataType).eql(reference.dataType);
            should(copy.arrayType).eql(reference.arrayType);
            should(copy.dimensions).eql(reference.dimensions);
            should(copy.value).eql(reference.value);
            should(encoded(copy)).eql(encoded(reference));
        });
    }

    it("still copies the elements of an array instead of sharing them", () => {
        const source = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 2, 3] });
        const copy = new Variant(source);
        should(copy.value).eql(source.value);
        should(copy.value).not.equal(source.value);
    });
});
