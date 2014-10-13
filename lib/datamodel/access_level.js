/**
 * @module opcua.datamodel
 */
var Enum = require("enum");
var assert = require("better-assert");

var AccessLevelFlag = new Enum({
    CurrentRead:  0x01,
    CurrentWrite: 0x02,
    HistoryRead:  0x04,
    HistoryWrite: 0x08,
    SemanticChange: 0x10
});

exports.AccessLevelFlag = AccessLevelFlag;

// @example
//      makeAccessLevel("CurrentRead | CurrentWrite").should.eql(0x03);
var makeAccessLevel = function(str) {
    var accessFlag = AccessLevelFlag.get(str);
    if (!accessFlag) {
        throw new Error("Invalid access flag specified " + str + " should be one of "  + AccessLevelFlag.enums);
    }
    return accessFlag;
};

var registerBasicType = require("../misc/factories_basic_type").registerBasicType;
var ec = require("../misc/encode_decode");

registerBasicType({
    name:"AccessLevelFlag",
    subtype:"Byte",
    defaultValue: function() {
        return makeAccessLevel("CurrentRead | CurrentWrite");
    },
    encode: function(value,stream) {
        stream.writeUInt8(value.value);
    },
    decode: function(stream) {
        var code = stream.readUInt8();
        return AccessLevelFlag.get(code);
    },
    coerce: function(value) {
        return makeAccessLevel(value);
    },
    random : function() {
        return defaultValue;
    }
});

exports.makeAccessLevel = makeAccessLevel;