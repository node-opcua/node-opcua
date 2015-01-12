require("requirish")._(module);

var should =require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var factories = require("lib/misc/factories_factories");
var hexDump = require("lib/misc/utils").hexDump;


var packet_analyzer = require("lib/misc/packet_analyzer").packet_analyzer;

//xx process.argv.push("DEBUG");

function dump_block_in_debug_mode(buffer,id) {

    if ( process.env.DEBUG )  {
        console.log(hexDump(buffer));
        packet_analyzer(buffer,id);

    }
}
function encode_decode_round_trip_test(obj,callback_buffer) {


    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should(obj).not.be.null;

    var expandedNodeId = obj.encodingDefaultBinary;

    var size = obj.binaryStoreSize();

    var stream  = new BinaryStream(size);

    obj.encode(stream);

    callback_buffer(stream._buffer,obj.encodingDefaultBinary);

    stream.rewind();

    var obj_reloaded = factories.constructObject(expandedNodeId);
    obj_reloaded.decode(stream);

    Object.keys(obj_reloaded).forEach(function(p) {

        try {
            JSON.stringify(obj_reloaded[p]).should.eql(JSON.stringify(obj[p]));
        } catch(err) {
            console.log(" ---------------------------------- error in encode_decode_round_trip_test".yellow);
            console.log(" key ".red,      p);
            console.log(" expected ".red, JSON.stringify(obj[p]));
            console.log(" actual   ".cyan,JSON.stringify(obj_reloaded[p]));

            // re throw exception
            throw err;
        }

    });

    return obj_reloaded;
}
exports.encode_decode_round_trip_test = encode_decode_round_trip_test;