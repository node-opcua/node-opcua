"use strict";
/**
 * @module opcua.utils
 */

var util = require("util");
var assert = require("node-opcua-assert");

/**
 * set a flag
 * @method set_flag
 * @param value
 * @param mask
 * @return {number}
 */
function set_flag(value, mask) {
    assert(mask !== undefined);
    return (value | mask.value);
}
exports.set_flag = set_flag;
/**
 * check if a set of bits are set in the values
 * @method check_flag
 *
 * @param value
 * @param mask
 * @return {boolean}
 */
function check_flag(value, mask) {
    assert(mask !== undefined && mask.value);
    return ((value & mask.value) === mask.value);
}
exports.check_flag = check_flag;



// ---------------------------------------------------------------------------------------------------------------------
var path = require("path");
/**
 * @method normalize_require_file
 * @param baseFolder
 * @param full_path_to_file
 *
 *
 * @example:
 *    normalize_require_file("/home/bob/folder1/","/home/bob/folder1/folder2/toto.js").should.eql("./folder2/toto");
 */
function normalize_require_file(baseFolder, full_path_to_file) {
    var local_file = path.relative(baseFolder, full_path_to_file).replace(/\\/g, "/");
    // append ./ if necessary
    if (local_file.substr(0, 1) !== ".") {
        local_file = "./" + local_file;
    }
    // remove extension
    local_file = local_file.substr(0, local_file.length - path.extname(local_file).length);
    return local_file;
}
exports.normalize_require_file = normalize_require_file;

exports.buffer_ellipsis = require("./src/buffer_ellipsis").buffer_ellipsis;

exports.capitalizeFirstLetter = require("./src/string_utils").capitalizeFirstLetter;
exports.lowerFirstLetter = require("./src/string_utils").lowerFirstLetter;

exports.getObjectClassName = require("./src/object_classname").getObjectClassName;

exports.get_clock_tick = require("./src/get_clock_tick").get_clock_tick;

exports.compare_buffers = require("./src/compare_buffers").compare_buffers;

function isNullOrUndefined(value)  {
    return ( value === undefined ) || (value === null);
}

exports.isNullOrUndefined = isNullOrUndefined;


exports.constructFilename = require("./src/construct_filename").constructFilename;
