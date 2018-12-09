"use strict";

const factories = require("node-opcua-factory");
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const assert = require("node-opcua-assert").assert;

const EnumBrowseDirection_Schema = {
    name: "BrowseDirection",
    enumValues: {
        Invalid: -1, //
        Forward: 0, // Return forward references.
        Inverse: 1, //Return inverse references.
        Both: 2  // Return forward and inverse references.
    },
    decode: function(stream) {

        assert(stream instanceof BinaryStream);
        const value = stream.readInteger();
        if (value<0 || value>2) {
            return exports.BrowseDirection.Invalid;
        }
        return exports.BrowseDirection.get(value);
    }
};
exports.EnumBrowseDirection_Schema = EnumBrowseDirection_Schema;

exports.BrowseDirection = factories.registerEnumeration(EnumBrowseDirection_Schema);

