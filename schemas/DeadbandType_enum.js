"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

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
