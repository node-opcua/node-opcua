import "should";
import { replaceBufferWithHexDump } from "..";

describe("replaceBufferWithHexDump", () => {
    it("replaceBufferWithHexDump", () => {
        let obj: Record<string, unknown> = { stuff: Buffer.from("ABCDEF") };

        obj = replaceBufferWithHexDump(obj);

        obj.should.eql({ stuff: "<BUFFER>414243444546</BUFFER>" });
    });
});
