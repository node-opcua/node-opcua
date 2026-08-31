import { decodeNodeId } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { decodeExtensionObject, encodeExtensionObject } from "node-opcua-extension-object";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { PubSubConfigurationDataType, PubSubConnectionDataType, UABinaryFileDataType } from "../dist/index.js";

//
// An ExtensionObject body is length-prefixed, so the encoder has to know the body size
// before it writes the body. It gets it by encoding the object a second time into a
// BinaryStreamSizeCalculator (binaryStoreSize()). Because an ExtensionObject's fields may
// themselves be ExtensionObjects, that sizing pass re-enters the same code for every
// child, and the work doubles at every level of nesting.
//
// These tests pin what any cheaper scheme has to keep true:
//   - the declared body length matches the bytes actually written, at every level
//   - binaryStoreSize() still equals the real encoded size
//   - the size calculator and the stream still agree
//   - the bytes still round-trip
//
// They are written against the two-pass implementation so they stay meaningful when it
// is replaced by reserve-then-backpatch.
//

/** build a 3-level nesting: UABinaryFileDataType > PubSubConfigurationDataType > PubSubConnectionDataType */
function makeNested(connectionCount: number): UABinaryFileDataType {
    const value = new PubSubConfigurationDataType({
        connections: Array.from({ length: connectionCount }, (_, i) => new PubSubConnectionDataType({ name: `conn-${i}` }))
    });
    return new UABinaryFileDataType({
        body: new Variant({ dataType: DataType.ExtensionObject, value })
    });
}

describe("ExtensionObject nesting - body length prefix", () => {
    it("should declare a body length equal to the bytes actually written", () => {
        const inner = new PubSubConfigurationDataType({
            connections: [new PubSubConnectionDataType({ name: "c0" })]
        });

        const buffer = Buffer.allocUnsafe(4096);
        const stream = new BinaryStream(buffer);
        encodeExtensionObject(inner, stream);
        const totalWritten = stream.length;

        // re-read the wire form: NodeId, then the encoding byte, then the UInt32 body length
        const reader = new BinaryStream(buffer.subarray(0, totalWritten));
        decodeNodeId(reader);
        reader.readUInt8().should.eql(0x01, "body should be encoded as a ByteString");
        const declaredBodyLength = reader.readUInt32();
        const headerLength = reader.length;

        declaredBodyLength.should.eql(
            totalWritten - headerLength,
            "the declared body length must match the number of body bytes actually written"
        );
    });

    it("should keep binaryStoreSize() equal to the real encoded length when nested", () => {
        for (const connectionCount of [0, 1, 3]) {
            const nested = makeNested(connectionCount);

            const predicted = nested.binaryStoreSize();
            const stream = new BinaryStream(Buffer.allocUnsafe(predicted + 64));
            nested.encode(stream);

            stream.length.should.eql(predicted, `binaryStoreSize() must match bytes written (${connectionCount} connections)`);
        }
    });

    it("should have the size calculator agree with the stream for a nested object", () => {
        const nested = makeNested(2);

        const calculator = new BinaryStreamSizeCalculator();
        nested.encode(calculator);

        const stream = new BinaryStream(Buffer.allocUnsafe(calculator.length + 64));
        nested.encode(stream);

        stream.length.should.eql(calculator.length);
    });

    it("should round-trip a nested ExtensionObject unchanged", () => {
        const nested = makeNested(3);

        const stream = new BinaryStream(Buffer.allocUnsafe(nested.binaryStoreSize()));
        nested.encode(stream);
        stream.rewind();

        const reloaded = new UABinaryFileDataType();
        reloaded.decode(stream);

        (reloaded.toJSON() as Record<string, unknown>).should.eql(nested.toJSON());
    });

    it("should produce a body that decodes standalone from its declared length", () => {
        // slicing exactly `declaredBodyLength` bytes must yield a complete, decodable object -
        // this is what a consumer that trusts the prefix will do
        const inner = new PubSubConfigurationDataType({
            connections: [new PubSubConnectionDataType({ name: "solo" })]
        });

        const buffer = Buffer.allocUnsafe(4096);
        const stream = new BinaryStream(buffer);
        encodeExtensionObject(inner, stream);

        const wire = buffer.subarray(0, stream.length);
        const reloaded = decodeExtensionObject(new BinaryStream(wire));

        should.exist(reloaded);
        ((reloaded as PubSubConfigurationDataType).toJSON() as Record<string, unknown>).should.eql(inner.toJSON());
    });

    it("should encode identically whether or not the size was computed first", () => {
        // binaryStoreSize() runs a full encode into a size calculator; doing it first must
        // not perturb the object or the bytes that the real encode then produces
        const a = makeNested(2);
        const b = makeNested(2);

        const bufferA = Buffer.allocUnsafe(4096);
        const streamA = new BinaryStream(bufferA);
        a.encode(streamA); // no sizing pass at this level

        b.binaryStoreSize(); // sizing pass first
        const bufferB = Buffer.allocUnsafe(4096);
        const streamB = new BinaryStream(bufferB);
        b.encode(streamB);

        streamA.length.should.eql(streamB.length);
        bufferA.subarray(0, streamA.length).should.eql(bufferB.subarray(0, streamB.length));
    });
});
