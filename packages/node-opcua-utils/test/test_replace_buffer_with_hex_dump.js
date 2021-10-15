"use strict";
require("should");
const replaceBufferWithHexDump = require("..").replaceBufferWithHexDump;

describe("replaceBufferWithHexDump", function () {
    it("replaceBufferWithHexDump", function () {
        let obj = { stuff: Buffer.from("ABCDEF") };

        obj = replaceBufferWithHexDump(obj);

        obj.should.eql({ stuff: "<BUFFER>414243444546</BUFFER>" });
    });
});
