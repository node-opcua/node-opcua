/**
 * @module opcua
 */
var StatusCodes = require("./../raw_status_codes").StatusCodes;
var _ = require("underscore");
var assert= require("better-assert");


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
    this.highword =  this.value ? 0x8000 + this.value : 0 ;
}

/**
 *
 * @method toString
 * @returns {string}
 */
StatusCode.prototype.toString = function() {
    return this.name +" (0x" + this.highword.toString(16) + "0000)" ;
};

exports.StatusCode = StatusCode;


var encodeStatusCode = function(statusCode,stream) {
    assert(statusCode instanceof StatusCode);
    stream.writeUInt16(0);
    stream.writeUInt16(statusCode.highword);
};

exports.encodeStatusCode = encodeStatusCode;

var decodeStatusCode = function(stream) {

    // read low word
    var l = stream.readUInt16();
    // read high word
    var h = stream.readUInt16();
    var code = h & 0x3FFF;

    var sc =  StatusCodes_reverse_map[code];
    assert(sc !== null,"expecting a known StatusCode");
    return sc;
};

exports.decodeStatusCode = decodeStatusCode;

/* construct status codes fast search indexes */
var StatusCodes_reverse_map = {};
_.forEach(StatusCodes, function(code) {
    code = new StatusCode(code);
    StatusCodes_reverse_map[code.value] = code;
    StatusCodes[code.name] = code;
});

/**
 * @module StatusCodes
 * @type {exports.StatusCodes|*}
 */
exports.StatusCodes = StatusCodes;
