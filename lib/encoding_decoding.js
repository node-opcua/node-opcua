var BinaryStream = require("./binaryStream").BinaryStream;

function decode_string(stream) {
    var value;
    var length = stream.readInteger();
    if (length == -1) {
        value = undefined;
    } else {
        value = stream.stream.toString(encoding = 'binary', stream.length, stream.length + length);
        stream.length += length;
    }
    return value;
}

function encode_string(value, stream) {

    if (value === undefined) {
        stream.writeInteger(-1);
        return;
    }
    stream.writeInteger(value.length);
    stream.stream.write(value, stream.length);
    stream.length += value.length;
}
exports.decode_string = decode_string;
exports.encode_string = encode_string;

exports.encodeInt32 = function(value, stream)
{
   stream.writeInteger(value);
};
exports.decodeInt32 = function(stream)
{
    return stream.readInteger();
};


