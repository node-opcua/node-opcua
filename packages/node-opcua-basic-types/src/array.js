"use strict";
var assert = require("node-opcua-assert");
var _ = require("underscore");
/**
 * @method encodeArray
 * @param arr {Array} the array to encode.
 * @param stream {BinaryStream}  the stream.
 * @param encode_element_func  {Function}  The  function to encode a single array element.
 * @param encode_element_func.element {object}
 * @param encode_element_func.stream  {BinaryStream}  the stream.
 */
exports.encodeArray = function (arr, stream, encode_element_func) {

    if (arr === null) {
        stream.writeUInt32(0xFFFFFFFF);
        return;
    }
    assert(_.isArray(arr));
    stream.writeUInt32(arr.length);
    for (var i = 0; i < arr.length; i++) {
        encode_element_func(arr[i], stream);
    }
};
/**
 * @method decodeArray
 * @param stream {BinaryStream}  the stream.
 * @param decode_element_func {Function}  The  function to decode a single array element. This function returns the element decoded from the stream
 * @param decode_element_func.stream {BinaryStream}  the stream.
 * @return {Array}
 */
exports.decodeArray = function (stream, decode_element_func) {

    var length = stream.readUInt32(stream);
    if (length === 0xFFFFFFFF) {
        return null;
    }

    var arr = [];
    for (var i = 0; i < length; i++) {
        arr.push(decode_element_func(stream));
    }

    return arr;
};


