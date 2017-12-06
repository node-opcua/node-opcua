"use strict";

var factories = require("node-opcua-factory");

var DeadbandType_Schema = {
    name:"DeadbandType",
    enumValues: {
        None:       0x00,
        Absolute:   0x01,
        Percent:    0x02,
        Invalid:      -1,

    }
};
exports.DeadbandType_Schema = DeadbandType_Schema;
exports.DeadbandType = factories.registerEnumeration(DeadbandType_Schema);
