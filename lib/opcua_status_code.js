
var StatusCodes = require("./raw_status_codes").StatusCodes;
var _ = require("underscore");
var assert= require("better-assert");


function StatusCode(options) {
    this.value = options.value;
    this.description = options.description;
    this.name = options.name;
    this.highword = 0x8000 + this.value;
}
StatusCode.prototype.toString = function() {
    return this.name +" (0x" + this.highword.toString(16) + "0000)" ;
}
exports.StatusCode = StatusCode;


var encodeStatusCode = function(statusCode,stream)
{
    assert(statusCode instanceof StatusCode);
    stream.writeUInt16(0);
    stream.writeUInt16(statusCode.highword);
}
exports.encodeStatusCode = encodeStatusCode;

var decodeStatusCode = function(stream)
{
    var l = stream.readUInt16();
    var h = stream.readUInt16();
    var code = h & 0x3FFF;

    var sc =  StatusCodes_reverse_map[code];
    if (!sc){
        console.log("code = ",code);
        return StatusCodes_reverse_map[1];
    }
    return sc;

}
exports.decodeStatusCode = decodeStatusCode;

/*
function makeStatusCode(statusCode, severity) {
    if (typeof(statusCode) === "string" && statusCode.substr(0,2) === "0x") {
        var a1 = "00000000" + statusCode.substr(2);
        a1 = a1.substr(a1.length-8);
        high = parseInt("0x"+a1.substr(0,4));
        low  = parseInt("0x"+a1.substr(4,8));
        return [ low.toString(16),high.toString(16)]
    } else {
        var util = require("util");
        assert(isFinite(statusCode.value), "invalid status code provided " + util.inspect(statusCode));
        high =  (statusCode.value | 0x8000);
        low  = 0;
        //xx var b = new Buffer(8);
        //xx b.writeUInt8(low  ,0);
        //xx b.writeUInt32LE(high,4);
        //xx return b.toString("hex");
        return [ low.toString(16),high.toString(16)]
    }
}
exports.makeStatusCode = makeStatusCode;

*/

var StatusCodes_reverse_map = {};
_.forEach(StatusCodes, function(code) {
    code = new StatusCode(code);
    StatusCodes_reverse_map[code.value] = code;
    StatusCodes[code.name] = code;
});
exports.StatusCodes = StatusCodes;
