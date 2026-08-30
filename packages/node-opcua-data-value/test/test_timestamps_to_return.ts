import { BinaryStream } from "node-opcua-binary-stream";
import "should";
import { decodeTimestampsToReturn, TimestampsToReturn } from "..";

describe("TimestampsToReturn", () => {
    it("should create an invalid timestampsToReturn", () => {
        const buffer = Buffer.alloc(10);
        const stream = new BinaryStream(buffer);
        stream.writeUInt32(0x3333);
        stream.rewind();
        const timestampToReturn = decodeTimestampsToReturn(stream);
        timestampToReturn.should.eql(TimestampsToReturn.Invalid);
    });
});
