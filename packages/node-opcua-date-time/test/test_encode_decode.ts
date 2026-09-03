import { BinaryStream } from "node-opcua-binary-stream";
import should from "should";
import { coerceDateTime, decodeDateTime, encodeDateTime, getMinOPCUADate, isMinDate, isValidDateTime } from "../dist/index.js";

describe("encode/decode DateTime", () => {
    it("should encode and decode min date", () => {
        const stream = new BinaryStream();

        const date = getMinOPCUADate();
        encodeDateTime(date, stream);

        stream.length.should.eql(8);
        stream.buffer.slice(0, 8).toString("hex").should.eql("0000000000000000");

        stream.rewind();
        const reloaded = decodeDateTime(stream);
        isMinDate(reloaded).should.eql(true);
        isValidDateTime(reloaded).should.eql(true);
    });
    it("should encode and decode null date", () => {
        const stream = new BinaryStream();
        encodeDateTime(null, stream);
        stream.length.should.eql(8);
        stream.buffer.slice(0, 8).toString("hex").should.eql("0000000000000000");

        stream.rewind();
        const reloaded = decodeDateTime(stream);
        isMinDate(reloaded).should.eql(true);
        isValidDateTime(reloaded).should.eql(true);
    });
    it("(coerceDateTime(null))", () => {
        const date = coerceDateTime(null);
        isMinDate(date).should.eql(true);
    });
    it("(coerceDateTime(new Date()))", () => {
        const date = coerceDateTime(new Date(1789, 6, 14));
        isMinDate(date).should.eql(false);
    });
    it("(coerceDateTime(", () => {
        const date = coerceDateTime("1789-07-14");
        isMinDate(date).should.eql(false);
    });
});

describe("encode/decode DateTime keeps the sub-millisecond ticks", () => {
    // an OPC UA DateTime counts 100 ns ticks; the remainder a Date cannot hold travels
    // as a `picoseconds` property on the Date (CTT Attribute Write Values 003)
    it("should round-trip a Date carrying picoseconds", () => {
        const stream = new BinaryStream();
        const date = new Date(Date.UTC(2026, 8, 3, 10, 0, 0, 123)) as Date & { picoseconds?: number };
        date.picoseconds = 456700000; // 456.7 microseconds = 4567 ticks
        encodeDateTime(date, stream);
        stream.rewind();
        const reloaded = decodeDateTime(stream) as Date & { picoseconds?: number };
        reloaded.getTime().should.eql(date.getTime());
        should(reloaded.picoseconds).eql(456700000);
    });
    it("should not add a picoseconds property to a whole-millisecond Date", () => {
        const stream = new BinaryStream();
        encodeDateTime(new Date(Date.UTC(2026, 8, 3, 10, 0, 0, 123)), stream);
        stream.rewind();
        const reloaded = decodeDateTime(stream) as Date & { picoseconds?: number };
        should(reloaded.picoseconds).eql(undefined);
    });
});
