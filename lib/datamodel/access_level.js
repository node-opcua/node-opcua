"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

var Enum = require("lib/misc/enum");
var assert = require("better-assert");

var registerBasicType = require("lib/misc/factories_basic_type").registerBasicType;
var ec = require("lib/misc/encode_decode");
var utils = require("lib/misc/utils");

var AccessLevelFlag = new Enum({
    CurrentRead:    0x01,//bit 0 : Indicate if the current value is readable (0 means not readable, 1 means readable).
    CurrentWrite:   0x02,//bit 1 : Indicate if the current value is writable (0 means not writable, 1 means writable).
    HistoryRead:    0x04,//bit 2 : Indicates if the history of the value is readable (0 means not readable, 1 means readable).
    HistoryWrite:   0x08,//bit 3 : Indicates if the history of the value is writable (0 means not writable, 1 means writable).
    SemanticChange: 0x10,//bit 4 : Indicates if the Variable used as Property generates SemanticChangeEvents
    StatusWrite:    0x20,//bit 5 : Indicates if the current StatusCode of the value is writable (0 means not writable, 1 means writable).
    TimestampWrite: 0x40,//bit 6 : Indicates if the current SourceTimestamp of the value is writable (0 means not writable, 1 means writable).

    NONE:           0x800
});

AccessLevelFlag.toByte = function (al) {
    return al.value & 0xFF;
};
exports.AccessLevelFlag = AccessLevelFlag;


// @example
//      makeAccessLevel("CurrentRead | CurrentWrite").should.eql(0x03);
var makeAccessLevel = function (str) {
    var accessFlag;
    if (str === "" || str === 0 ) {
        accessFlag = AccessLevelFlag.get("NONE");
    } else {
        accessFlag = AccessLevelFlag.get(str);
    }

    if (utils.isNullOrUndefined(accessFlag)) {
        throw new Error("Invalid access flag specified '" + str + "' should be one of " + AccessLevelFlag.enums);
    }
    return accessFlag;
};


registerBasicType({
    name: "AccessLevelFlag",
    subtype: "Byte",
    defaultValue: function () {
        return makeAccessLevel("CurrentRead | CurrentWrite");
    },
    encode: function (value, stream) {
        stream.writeUInt8(value.value & 0x8F);
    },
    decode: function (stream) {
        var code = stream.readUInt8();
        return AccessLevelFlag.get(code ? code : AccessLevelFlag.NONE.value);
    },
    coerce: function (value) {
        return makeAccessLevel(value);
    },
    random: function () {
        return this.defaultValue();
    }
});

exports.makeAccessLevel = makeAccessLevel;
