"use strict";
require("should");
var replaceBufferWithHexDump = require("../src/replace_buffer_with_hex_dump").replaceBufferWithHexDump;

describe("replaceBufferWithHexDump",function() {
    it("replaceBufferWithHexDump", function () {

        var obj = {stuff: new Buffer("ABCDEF")};

        obj = replaceBufferWithHexDump(obj);

        obj.should.eql({stuff: "<BUFFER>414243444546</BUFFER>"});

    });


});
