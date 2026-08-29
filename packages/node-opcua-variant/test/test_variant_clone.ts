import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId, type NodeId } from "node-opcua-nodeid";
import should from "should";
import { DataType, sameVariant, Variant, VariantArrayType } from "..";

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
    make(): unknown;
    // method syntax on purpose: it is bivariant, so each entry may narrow `value`
    // to its own concrete type (Buffer, Date, NodeId, ...)
    mutate(value: unknown): void;
    read(value: unknown): unknown;
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

    it("should preserve an empty LocalizedText rather than turning it into null", () => {
        // LocalizedText's option constructor defaults with `options.text || null`, so it
        // cannot itself produce an empty text - the field has to be assigned, which is what
        // decoding does and what leaves an uncommented Condition carrying "". A clone that
        // round-trips through that constructor turns the "" into null.
        const emptyText = new LocalizedText(null);
        emptyText.text = "";
        const source = new Variant({ dataType: DataType.LocalizedText, value: emptyText });

        const clone = source.clone();

        should(clone.value.text).eql("", "an empty text must survive the clone");
    });

    it("should preserve an empty QualifiedName name rather than turning it into null", () => {
        const emptyName = new QualifiedName(null);
        emptyName.name = "";
        const source = new Variant({ dataType: DataType.QualifiedName, value: emptyName });

        const clone = source.clone();

        should(clone.value.name).eql("", "an empty name must survive the clone");
    });

    it("should preserve locale and namespaceIndex", () => {
        const text = new Variant({
            dataType: DataType.LocalizedText,
            value: new LocalizedText({ locale: "fr-FR", text: "bonjour" })
        }).clone();
        should(text.value.locale).eql("fr-FR");
        should(text.value.text).eql("bonjour");

        const name = new Variant({
            dataType: DataType.QualifiedName,
            value: new QualifiedName({ namespaceIndex: 3, name: "thing" })
        }).clone();
        should(name.value.namespaceIndex).eql(3);
        should(name.value.name).eql("thing");
    });

    it("should preserve the picoseconds carried on a DateTime", () => {
        // node-opcua hangs sub-millisecond precision on the Date instance itself
        const precise = new Date(Date.UTC(2026, 0, 1)) as Date & { picoseconds?: number };
        precise.picoseconds = 1234;
        const source = new Variant({ dataType: DataType.DateTime, value: precise });

        const clone = source.clone();

        should((clone.value as Date & { picoseconds?: number }).picoseconds).eql(1234);
        should(clone.value.getTime()).eql(precise.getTime());
    });

    it("should tolerate a null payload", () => {
        const clone = new Variant({ dataType: DataType.Double, value: null }).clone();
        should(clone.value).eql(null);
    });
});

//
// sameVariant is what MonitoredItem uses to decide whether a sampled value changed. Its
// scalar branch handled ExtensionObject, Array and Buffer and let everything else fall
// through to "different" - so two equal NodeIds, LocalizedTexts, QualifiedNames or Dates
// only ever compared equal through the `v1.value === v2.value` shortcut, i.e. when they
// were literally the same instance.
//
// That was already wrong for values that arrive separately - anything decoded off the wire
// - and it became visible the moment clone() stopped sharing the instance: every sample
// looked like a change, and the server published duplicate notifications.
//
describe("sameVariant on scalar object values", () => {
    for (const { name, dataType, make } of [
        { name: "NodeId", dataType: DataType.NodeId, make: () => coerceNodeId("ns=1;i=42") },
        { name: "LocalizedText", dataType: DataType.LocalizedText, make: () => new LocalizedText({ text: "hello" }) },
        { name: "QualifiedName", dataType: DataType.QualifiedName, make: () => new QualifiedName({ name: "hello" }) },
        { name: "DateTime", dataType: DataType.DateTime, make: () => new Date(Date.UTC(2026, 0, 1)) }
    ]) {
        it(`should treat two equal but distinct ${name} values as the same`, () => {
            const a = new Variant({ dataType, value: make() });
            const b = new Variant({ dataType, value: make() });

            sameVariant(a, b).should.eql(true, `two equal ${name} values compared as different`);
        });

        it(`should still treat a cloned ${name} as the same`, () => {
            const a = new Variant({ dataType, value: make() });

            sameVariant(a, a.clone()).should.eql(true, `a cloned ${name} compared as different from its source`);
        });
    }

    it("should still detect a genuine change", () => {
        const a = new Variant({ dataType: DataType.LocalizedText, value: new LocalizedText({ text: "before" }) });
        const b = new Variant({ dataType: DataType.LocalizedText, value: new LocalizedText({ text: "after" }) });

        sameVariant(a, b).should.eql(false);
    });

    it("should still detect a genuine NodeId change", () => {
        const a = new Variant({ dataType: DataType.NodeId, value: coerceNodeId("ns=1;i=42") });
        const b = new Variant({ dataType: DataType.NodeId, value: coerceNodeId("ns=1;i=43") });

        sameVariant(a, b).should.eql(false);
    });
});
