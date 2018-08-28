"use strict";
const TimestampsToReturn = require("..").TimestampsToReturn;
const decodeTimestampsToReturn = require("..").decodeTimestampsToReturn;
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
require("should");

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

