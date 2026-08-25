import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId, type NodeId } from "node-opcua-nodeid";
import should from "should";
import { DataType, Variant, VariantArrayType } from "..";

//
// Variant.clone() has to be a true deep copy. The server records a clone of every sampled
// value and keeps it while the notification sits in the queue, so anything the clone still
// shares with the source can be rewritten afterwards - the client would then be told a
// different thing happened at a timestamp already gone by.
//
// Numbers, strings and booleans are immutable and need no copying. Everything whose value
// is a live object does: Buffers, Dates, NodeIds, LocalizedTexts, QualifiedNames and
// ExtensionObjects, whether they appear on their own or inside an array.
//

/** for each mutable DataType: how to build one, how to write it, and what to read back */
const mutableTypes: {
    name: string;
    dataType: DataType;
    make: () => unknown;
    mutate: (value: never) => void;
    read: (value: never) => unknown;
}[] = [
    {
        name: "ByteString",
        dataType: DataType.ByteString,
        make: () => Buffer.from([1, 2, 3]),
        mutate: (v: Buffer) => {
            v[0] = 99;
        },
        read: (v: Buffer) => v[0]
    },
    {
        name: "DateTime",
        dataType: DataType.DateTime,
        make: () => new Date(Date.UTC(2026, 0, 1)),
        mutate: (v: Date) => v.setUTCFullYear(1999),
        read: (v: Date) => v.getUTCFullYear()
    },
    {
        name: "NodeId",
        dataType: DataType.NodeId,
        make: () => coerceNodeId("ns=1;i=42"),
        mutate: (v: NodeId) => {
            v.value = 99;
        },
        read: (v: NodeId) => v.value
    },
    {
        name: "LocalizedText",
        dataType: DataType.LocalizedText,
        make: () => new LocalizedText({ text: "original" }),
        mutate: (v: LocalizedText) => {
            v.text = "mutated";
        },
        read: (v: LocalizedText) => v.text
    },
    {
        name: "QualifiedName",
        dataType: DataType.QualifiedName,
        make: () => new QualifiedName({ name: "original" }),
        mutate: (v: QualifiedName) => {
            v.name = "mutated";
        },
        read: (v: QualifiedName) => v.name
    }
];

describe("Variant.clone deep-copy guarantees", () => {
    for (const { name, dataType, make, mutate, read } of mutableTypes) {
        it(`should isolate a scalar ${name} from later writes to the source`, () => {
            const source = new Variant({ dataType, value: make() });

            const clone = source.clone();
            const before = read(clone.value);
            mutate(source.value);

            should(read(clone.value)).eql(before, `writing the source ${name} changed the clone`);
        });

        it(`should isolate an array of ${name} from later writes to the source`, () => {
            const source = new Variant({ dataType, arrayType: VariantArrayType.Array, value: [make(), make()] });

            const clone = source.clone();
            const before = read(clone.value[0]);
            mutate(source.value[0]);

            should(read(clone.value[0])).eql(before, `writing an element of the source ${name}[] changed the clone`);
        });
    }

    it("should copy a typed array rather than aliasing its buffer", () => {
        const source = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array([1, 2, 3])
        });

        const clone = source.clone();
        source.value[0] = 99;

        clone.value[0].should.eql(1);
        clone.value.buffer.should.not.equal(source.value.buffer);
    });

    it("should copy the dimensions array of a matrix", () => {
        const source = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 2],
            value: new Float64Array([1, 2, 3, 4])
        });

        const clone = source.clone();
        should.exist(clone.dimensions);
        (clone.dimensions as number[]).should.not.equal(source.dimensions);

        (source.dimensions as number[])[0] = 99;

        (clone.dimensions as number[])[0].should.eql(2);
    });

    it("should preserve dataType, arrayType and values", () => {
        const source = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Array,
            value: new Int32Array([4, 5, 6])
        });

        const clone = source.clone();

        clone.dataType.should.eql(DataType.Int32);
        clone.arrayType.should.eql(VariantArrayType.Array);
        Array.from(clone.value).should.eql([4, 5, 6]);
    });

    it("should leave immutable payloads alone", () => {
        for (const [dataType, value] of [
            [DataType.Double, 1.5],
            [DataType.String, "hello"],
            [DataType.Boolean, true],
            [DataType.UInt32, 7]
        ] as [DataType, unknown][]) {
            const clone = new Variant({ dataType, value }).clone();
            should(clone.value).eql(value);
        }
    });

    it("should tolerate a null payload", () => {
        const clone = new Variant({ dataType: DataType.Double, value: null }).clone();
        should(clone.value).eql(null);
    });
});
