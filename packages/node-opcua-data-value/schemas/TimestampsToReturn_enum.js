"use strict";

var assert = require("node-opcua-assert");
var factories = require("node-opcua-factory");
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var TimestampsToReturn;
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
TimestampsToReturn = exports.TimestampsToReturn = factories.registerEnumeration(TimestampsToReturn_Schema);
