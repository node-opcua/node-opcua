

var loremIpsum = require("./lorem_ipsum").loremIpsum;

function make_lorem_ipsum_buffer() {
    return new Buffer(loremIpsum);
}

exports.make_lorem_ipsum_buffer = make_lorem_ipsum_buffer;


function make_simple_buffer(chunkSize) {

    // feed chunk-manager on byte at a time
    var n = (chunkSize) * 4 + 12;

    var buf = new Buffer(n);
    for (var i = 0; i < n; i += 1) {
        buf.writeUInt8(i % 256, i);
    }
    return buf;

}

