const should = require("should");
const { BinaryStream } = require("node-opcua-binary-stream");
const { EnumValueType } = require("../dist"); // node-opcua-types"

function doTest(r) {
    const binaryStream = new BinaryStream();

    r.encode(binaryStream);

    binaryStream.rewind();

    const r2 = new EnumValueType();
    r2.decode(binaryStream);

    r2.toString().should.eql(r.toString());
    console.log(r2.toString());
}

describe("Issue 688", () => {
    it("EnumValue with empty constructor", () => {
        const r = new EnumValueType({});
        doTest(r);
    });
    it("EnumValue with value=10", () => {
        const r = new EnumValueType({
            value: 10
        });
        doTest(r);
    });
    it("EnumValue with value=-10", () => {
        const r = new EnumValueType({
            value: -32168,
            
        });
        doTest(r);
    });
});
