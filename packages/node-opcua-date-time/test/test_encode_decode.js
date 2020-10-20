
const { BinaryStream } = require("node-opcua-binary-stream");
const { isValidDateTime, encodeDateTime, minOPCUADate, decodeDateTime, isMinDate, coerceDateTime } = require("..");
const should = require("should");
describe("encode/decode DateTime", () => {
    it("should encode and decode min date", () => {

        const stream = new BinaryStream();

        const date = minOPCUADate;
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
