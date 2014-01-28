
var should =require("should");
var BinaryStream = require("../lib/nodeopcua").BinaryStream;
var factories = require("../lib/factories");

function encode_decode_round_trip_test(obj) {

    should(obj).not.be.null;

    var expandedId = obj.encodingDefaultBinary;

    var size = obj.binaryStoreSize();

    var stream  = new BinaryStream(size);

    obj.encode(stream);

    stream.rewind();

    var obj_reloaded = factories.constructObject(expandedId);
    obj_reloaded.decode(stream);

    obj_reloaded.should.eql(obj);

    return obj_reloaded;
}
exports.encode_decode_round_trip_test = encode_decode_round_trip_test;