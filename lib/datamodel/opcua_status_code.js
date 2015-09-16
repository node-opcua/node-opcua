"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

var StatusCodes = require("lib/raw_status_codes").StatusCodes;

var OVERFLOWBIT = 0x480;
StatusCodes.GoodWithOverflowBit = {
    name: 'GoodWithOverflowBit',
    value: 0 | OVERFLOWBIT,
    description: 'GoodWithOverflowBit'
};

StatusCodes.Bad = {
    name: 'Bad',
    value: 0x80000000,
    description: 'The value is bad but no specific reason is known.'
};

StatusCodes.Uncertain = {
    name: 'Uncertain',
    value: 0x40000000,
    description: 'The value is uncertain but no specific reason is known.'
};


var _ = require("underscore");
var assert = require("better-assert");


/**
 * a particular StatusCode , with it's value , name and description
 *
 * @class  StatusCode
 * @param options
 * @param options.value
 * @param options.description
 * @param options.name
 *
 * @constructor
 */
function StatusCode(options) {

    this.value = options.value;
    this.description = options.description;
    this.name = options.name;

    //xx this.highword =  this.value ? 0x8000 + this.value : 0 ;
}

/**
 *
 * @method toString
 * @return {string}
 */
StatusCode.prototype.toString = function () {
    return this.name + " (0x" + ("0000" + this.value.toString(16)).substr(-8) + ")";
};

exports.StatusCode = StatusCode;


var encodeStatusCode = function (statusCode, stream) {
    assert(statusCode instanceof StatusCode);
    stream.writeUInt32(statusCode.value);
};

exports.encodeStatusCode = encodeStatusCode;

var decodeStatusCode = function (stream) {
    var code = stream.readUInt32();
    var sc = StatusCodes_reverse_map[code];
    assert(sc !== null && "expecting a known StatusCode");
    return sc;
};

exports.decodeStatusCode = decodeStatusCode;

/* construct status codes fast search indexes */
var StatusCodes_reverse_map = {};
_.forEach(StatusCodes, function (code) {
    code = new StatusCode(code);
    StatusCodes_reverse_map[code.value] = code;
    StatusCodes[code.name] = code;
});

/**
 * @module StatusCodes
 * @type {exports.StatusCodes|*}
 */
exports.StatusCodes = StatusCodes;
