require("requirish")._(module);

var should =require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var factories = require("lib/misc/factories_factories");
var hexDump = require("lib/misc/utils").hexDump;
var assert_arrays_are_equal = require("test/helpers/typedarray_helpers").assert_arrays_are_equal;
var _ = require("underscore");

var packet_analyzer = require("lib/misc/packet_analyzer").packet_analyzer;

//xx process.argv.push("DEBUG");

function dump_block_in_debug_mode(buffer,id,options) {

    if ( process.env.DEBUG )  {
        console.log(hexDump(buffer));
        packet_analyzer(buffer,id,0,0,options);
    }
}
function isTypedArray(v) {
    if (v && v.buffer && v.buffer instanceof ArrayBuffer) {
        return true;
    }
    return false;
}
function isArrayOrTypedArray(v) {
    return isTypedArray(v) || v instanceof Array;
}
/**
 *
 * @param obj {Object} : object to test ( the object must provide a binaryStoreSize,encode,decode method
 * @param [options]
 * @param callback_buffer
 * @return {*}
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


    function redirectToNull(functor) {
        var old = console.log;
        console.log = (function() {}).bind(console);
        functor();
        console.log = old;

    }
    var analyze_object_binary_encoding = require("lib/misc/packet_analyzer").analyze_object_binary_encoding;
    redirectToNull(function() {analyze_object_binary_encoding(obj);});


    Object.keys(obj_reloaded).forEach(function(p) {

        try {
            if (isArrayOrTypedArray(obj[p])) {
                assert_arrays_are_equal(obj_reloaded[p],obj[p]);
            } else {
                JSON.stringify(obj_reloaded[p]).should.eql(JSON.stringify(obj[p]));
            }
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
