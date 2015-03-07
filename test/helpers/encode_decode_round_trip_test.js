require("requirish")._(module);

var should =require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var factories = require("lib/misc/factories_factories");
var hexDump = require("lib/misc/utils").hexDump;

var _ = require("underscore");

var packet_analyzer = require("lib/misc/packet_analyzer").packet_analyzer;

//xx process.argv.push("DEBUG");

function dump_block_in_debug_mode(buffer,id,options) {

    if ( process.env.DEBUG )  {
        console.log(hexDump(buffer));
        packet_analyzer(buffer,id,0,0,options);

    }
}
/**
 *
 * @param obj {Object} : object to test ( the object must provide a binaryStoreSize,encode,decode method
 * @param [options]
 * @param callback_buffer
 * @returns {*}
 */
function encode_decode_round_trip_test(obj,options, callback_buffer) {

    if (!callback_buffer && _.isFunction(options) ) {
        callback_buffer = options;
        options = {};
    }

    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should(obj).not.be.null;

    var expandedNodeId = obj.encodingDefaultBinary;

    var size = obj.binaryStoreSize(options);

    var stream  = new BinaryStream(new Buffer(size));

    obj.encode(stream,options);

    callback_buffer(stream._buffer,obj.encodingDefaultBinary,options);

    stream.rewind();

    var obj_reloaded = factories.constructObject(expandedNodeId);
    obj_reloaded.decode(stream,options);

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
