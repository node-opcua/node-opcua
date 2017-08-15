"use strict";

const buffer_ellipsis = require("./buffer_ellipsis").buffer_ellipsis;

function compare_buffers(buf1, buf2, max_length) {

    max_length = max_length || buf2.length;
    var block_length = 80;
    var cursor = 0;
    while (cursor < max_length) {
        var slice1 = buf1.slice(cursor, cursor + block_length);
        var slice2 = buf2.slice(cursor, cursor + block_length);
        if (slice2.toString("hex") !== slice1.toString("hex")) {
            console.log("pos = ", cursor);
            console.log("slice1 :", buffer_ellipsis(slice1).yellow);
            console.log("slice2 :", buffer_ellipsis(slice2).blue);
        }
        cursor += block_length;
    }
    // xx buf1.length.should.equal(max_length);

}
exports.compare_buffers = compare_buffers;
