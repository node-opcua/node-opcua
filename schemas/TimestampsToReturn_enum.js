"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var factories = require("lib/misc/factories");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

var TimestampsToReturn_Schema = {
    name: "TimestampsToReturn",
    enumValues: {
        Invalid:      -1,
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    },
    decode: function(stream) {

        assert(stream instanceof BinaryStream);
        var value = stream.readInteger();
        if (value<0 || value>3) {
            return TimestampsToReturn.Invalid;
        }
        return TimestampsToReturn.get(value);
    }
};
exports.TimestampsToReturn_Schema = TimestampsToReturn_Schema;
var TimestampsToReturn = exports.TimestampsToReturn = factories.registerEnumeration(TimestampsToReturn_Schema);