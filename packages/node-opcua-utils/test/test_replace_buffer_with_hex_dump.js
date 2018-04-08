"use strict";
require("should");
const replaceBufferWithHexDump = require("../dist/replace_buffer_with_hex_dump").replaceBufferWithHexDump;

describe("replaceBufferWithHexDump", function() {
    it("replaceBufferWithHexDump", function() {
        let obj = { stuff: new Buffer("ABCDEF") };

        obj = replaceBufferWithHexDump(obj);

        obj.should.eql({ stuff: "<BUFFER>414243444546</BUFFER>" });
    });
});
