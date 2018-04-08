"use strict";

const assert = require("node-opcua-assert").assert;
const factories = require("node-opcua-factory");
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
let TimestampsToReturn;
const TimestampsToReturn_Schema = {
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
        const value = stream.readInteger();
        if (value<0 || value>3) {
            return TimestampsToReturn.Invalid;
        }
        return TimestampsToReturn.get(value);
    }
};
exports.TimestampsToReturn_Schema = TimestampsToReturn_Schema;
TimestampsToReturn = exports.TimestampsToReturn = factories.registerEnumeration(TimestampsToReturn_Schema);
