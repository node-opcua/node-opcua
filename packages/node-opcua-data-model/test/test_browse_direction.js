const { BinaryStream } = require("node-opcua-binary-stream");
const { encodeBrowseDirection, decodeBrowseDirection, BrowseDirection } = require("..");

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
        encodeBrowseDirection(36 /* wrong */, stream);
        stream.rewind();
        const reloaded = decodeBrowseDirection(stream);
        reloaded.should.eql(BrowseDirection.Invalid);
    });
});
