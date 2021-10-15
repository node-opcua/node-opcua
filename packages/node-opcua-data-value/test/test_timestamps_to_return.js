"use strict";
const { BinaryStream } = require("node-opcua-binary-stream");
require("should");
const { TimestampsToReturn, decodeTimestampsToReturn } = require("..");

describe("TimestampsToReturn", function () {
    it("should create an invalid timestampsToReturn", function () {
        const buffer = Buffer.alloc(10);
        const stream = new BinaryStream(buffer);
        stream.writeUInt32(0x3333);
        stream.rewind();
        const timestampToReturn = decodeTimestampsToReturn(stream);
        timestampToReturn.should.eql(TimestampsToReturn.Invalid);
    });
});
