import "should";
import type { Int64 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { EnumValueType } from "../dist"; // node-opcua-types"

function doTest(r: EnumValueType) {
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
            // the runtime coerces a plain number through coerceInt64. The generated options type
            // says Int64, which is UInt32[], because the generator has no Int64Like to emit.
            value: 10 as unknown as Int64
        });
        doTest(r);
    });
    it("EnumValue with value=-10", () => {
        const r = new EnumValueType({
            // the runtime coerces a plain number through coerceInt64. The generated options type
            // says Int64, which is UInt32[], because the generator has no Int64Like to emit.
            value: -32168 as unknown as Int64
        });
        doTest(r);
    });
});
