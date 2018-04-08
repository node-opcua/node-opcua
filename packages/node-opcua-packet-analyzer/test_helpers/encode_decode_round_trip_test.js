"use strict";

const should = require("should");
const _ = require("underscore");


const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const hexDump = require("node-opcua-debug").hexDump;
const factories = require("node-opcua-factory");

const assert_arrays_are_equal = require("node-opcua-test-helpers/src/typedarray_helpers").assert_arrays_are_equal;

const packet_analyzer = require("..").packet_analyzer;
const analyze_object_binary_encoding = require("..").analyze_object_binary_encoding;

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
 * @method encode_decode_round_trip_test
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

    const expandedNodeId = obj.encodingDefaultBinary;

    const size = obj.binaryStoreSize(options);

    const stream = new BinaryStream(new Buffer(size));

    obj.encode(stream, options);

    callback_buffer(stream._buffer, obj.encodingDefaultBinary, options);

    stream.rewind();

    const obj_reloaded = factories.constructObject(expandedNodeId);
    obj_reloaded.decode(stream, options);

    function redirectToNull(functor) {
        const old = console.log;

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

    const json =    JSON.stringify(obj);

    const obj_reloaded = JSON.parse(json);

    //xx console.log(json);

    compare(obj_reloaded,obj);

    return obj_reloaded;

}
exports.json_encode_decode_round_trip_test =  json_encode_decode_round_trip_test;