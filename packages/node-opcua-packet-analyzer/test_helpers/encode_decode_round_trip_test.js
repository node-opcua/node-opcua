"use strict";

var should = require("should");
var _ = require("underscore");


var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var hexDump = require("node-opcua-debug").hexDump;
var factories = require("node-opcua-factory");

var assert_arrays_are_equal = require("node-opcua-test-helpers/src/typedarray_helpers").assert_arrays_are_equal;

var packet_analyzer = require("..").packet_analyzer;
var analyze_object_binary_encoding = require("..").analyze_object_binary_encoding;

function dump_block_in_debug_mode(buffer, id, options) {
    if (process.env.DEBUG) {
        console.log(hexDump(buffer));
        packet_analyzer(buffer, id, 0, 0, options);
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

function compare(obj_reloaded,obj) {
    Object.keys(obj_reloaded).forEach(function (p) {

        try {
            if (isArrayOrTypedArray(obj[p])) {
                assert_arrays_are_equal(obj_reloaded[p], obj[p]);
            } else {
                JSON.stringify(obj_reloaded[p]).should.eql(JSON.stringify(obj[p]));
            }
        } catch (err) {
            console.log(" ---------------------------------- error in encode_decode_round_trip_test".yellow);
            console.log(" key ".red, p);
            console.log(" expected ".red, JSON.stringify(obj[p]));
            console.log(" actual   ".cyan, JSON.stringify(obj_reloaded[p]));
            // re throw exception
            throw err;
        }
    });
}


/**
 *
 * @param obj {Object} : object to test ( the object must provide a binaryStoreSize,encode,decode method
 * @param [options]
 * @param callback_buffer
 * @return {*}
 */
function encode_decode_round_trip_test(obj, options, callback_buffer) {

    if (!callback_buffer && _.isFunction(options)) {
        callback_buffer = options;
        options = {};
    }

    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should.exist(obj);

    var expandedNodeId = obj.encodingDefaultBinary;

    var size = obj.binaryStoreSize(options);

    var stream = new BinaryStream(new Buffer(size));

    obj.encode(stream, options);

    callback_buffer(stream._buffer, obj.encodingDefaultBinary, options);

    stream.rewind();

    var obj_reloaded = factories.constructObject(expandedNodeId);
    obj_reloaded.decode(stream, options);

    function redirectToNull(functor) {
        var old = console.log;

        console.log = function () { };

        try {
            functor();
        }
        catch(err) {
            throw err;
        }
        finally  {
            console.log = old;
        }

    }

    redirectToNull(function () {
        analyze_object_binary_encoding(obj);
    });

    compare(obj_reloaded,obj);

    return obj_reloaded;
}
exports.encode_decode_round_trip_test = encode_decode_round_trip_test;


function json_encode_decode_round_trip_test(obj, options, callback_buffer) {
    if (!callback_buffer && _.isFunction(options)) {
        callback_buffer = options;
        options = {};
    }
    callback_buffer = callback_buffer || dump_block_in_debug_mode;

    should.exist(obj);

    var json =    JSON.stringify(obj);

    var obj_reloaded = JSON.parse(json);

    //xx console.log(json);

    compare(obj_reloaded,obj);

    return obj_reloaded;

}
exports.json_encode_decode_round_trip_test =  json_encode_decode_round_trip_test;