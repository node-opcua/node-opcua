import { BinaryStream } from "node-opcua-binary-stream";
import { BrowseDirection, decodeBrowseDirection, encodeBrowseDirection } from "..";

describe("BrowseDirection", () => {
    it("encodeBrowseDirection", () => {
        const stream = new BinaryStream();
        encodeBrowseDirection(BrowseDirection.Both, stream);

        stream.rewind();
        const reloaded = decodeBrowseDirection(stream);
        reloaded.should.eql(BrowseDirection.Both);
    });
    it("encodeBrowseDirection - invalid", () => {
        const stream = new BinaryStream();
        // deliberately out of range: the point of the test is what encoding an invalid
        // BrowseDirection does, so the cast states the intent
        encodeBrowseDirection(36 as BrowseDirection /* wrong */, stream);
        stream.rewind();
        const reloaded = decodeBrowseDirection(stream);
        reloaded.should.eql(BrowseDirection.Invalid);
    });
});
