import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { DataValue } from "../dist/index.js";

//
// DataValue.clone() is load-bearing on the server's sampling path: MonitoredItem records
// a clone of the sampled value and keeps it (as oldDataValue) and hands it to the queued
// notification. If the clone shared any mutable state with the source, a later write to
// the address space would retroactively change a value that was already recorded - the
// client would be told the wrong thing happened at that timestamp.
//
// So the clone must be a *true* clone. These tests pin that, independently of how the
// clone is implemented, so the implementation can be made cheaper without weakening it.
//

describe("DataValue.clone", () => {
    it("should copy every field", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 42.5 }),
            statusCode: StatusCodes.BadWaitingForInitialData,
            sourceTimestamp: new Date(Date.UTC(2026, 1, 2, 3, 4, 5)),
            sourcePicoseconds: 1234,
            serverTimestamp: new Date(Date.UTC(2026, 1, 2, 3, 4, 6)),
            serverPicoseconds: 5678
        });

        const clone = source.clone();

        clone.value.dataType.should.eql(source.value.dataType);
        clone.value.value.should.eql(source.value.value);
        clone.statusCode.should.eql(source.statusCode);
        (clone.sourceTimestamp as Date).getTime().should.eql((source.sourceTimestamp as Date).getTime());
        clone.sourcePicoseconds.should.eql(source.sourcePicoseconds);
        (clone.serverTimestamp as Date).getTime().should.eql((source.serverTimestamp as Date).getTime());
        clone.serverPicoseconds.should.eql(source.serverPicoseconds);
    });

    it("should not share the Variant instance with the source", () => {
        const source = new DataValue({ value: new Variant({ dataType: DataType.Double, value: 1.5 }) });

        const clone = source.clone();

        clone.value.should.not.equal(source.value, "the clone must own its Variant");
    });

    it("should isolate a scalar value from later writes to the source", () => {
        const source = new DataValue({ value: new Variant({ dataType: DataType.Double, value: 1.5 }) });
        const clone = source.clone();

        source.value.value = 99;

        clone.value.value.should.eql(1.5);
    });

    it("should isolate a typed array from later writes to the source", () => {
        // the case that actually costs: the array must be copied, not aliased, or the
        // recorded sample mutates under the client
        const array = new Float64Array([1, 2, 3, 4]);
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: array })
        });

        const clone = source.clone();
        source.value.value[0] = 999;

        clone.value.value[0].should.eql(1, "the clone must not see writes made to the source array");
        clone.value.value.buffer.should.not.equal(source.value.value.buffer, "the clone must own its ArrayBuffer");
    });

    it("should isolate a plain array from later writes to the source", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["a", "b"] })
        });

        const clone = source.clone();
        source.value.value[0] = "changed";

        clone.value.value[0].should.eql("a");
    });

    it("should isolate a ByteString from later writes to the source", () => {
        // A ByteString is a Buffer, and a server that fills a Buffer in place rather than
        // replacing it would otherwise rewrite a sample that was already recorded and
        // queued. The clone has to own its bytes.
        const buffer = Buffer.from([1, 2, 3]);
        const source = new DataValue({ value: new Variant({ dataType: DataType.ByteString, value: buffer }) });

        const clone = source.clone();
        clone.value.value.should.eql(buffer);

        buffer[0] = 99;

        clone.value.value[0].should.eql(1, "writing the source Buffer must not change the clone");
        clone.value.value.should.not.equal(buffer, "the clone must own its Buffer");
    });

    it("should isolate an array of ByteStrings from later writes to the source", () => {
        const first = Buffer.from([1, 2]);
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Array,
                value: [first, Buffer.from([3, 4])]
            })
        });

        const clone = source.clone();
        first[0] = 99;

        clone.value.value[0][0].should.eql(1, "writing an element Buffer must not change the clone");
    });

    it("should tolerate a DataValue with no value", () => {
        const source = new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });

        const clone = source.clone();

        should.exist(clone.value);
        clone.value.dataType.should.eql(DataType.Null);
        clone.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
    });

    it("should leave the source untouched", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array([7, 8]) }),
            statusCode: StatusCodes.Good,
            sourceTimestamp: new Date(Date.UTC(2026, 0, 1))
        });
        const before = source.toString();

        source.clone();

        source.toString().should.eql(before);
    });

    it("should survive a round of clone-of-clone without aliasing", () => {
        // MonitoredItem clones what it was given and keeps the result; a second clone of
        // that must still be independent
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1, 2, 3]) })
        });

        const first = source.clone();
        const second = first.clone();
        first.value.value[0] = 42;

        second.value.value[0].should.eql(1);
        source.value.value[0].should.eql(1);
    });
});
