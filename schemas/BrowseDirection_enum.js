"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");
var EnumBrowseDirection_Schema = {
    name: "BrowseDirection",
    enumValues: {
        Forward: 0, // Return forward references.
        Inverse: 1, //Return inverse references.
        Both: 2  // Return forward and inverse references.
    }
};
exports.EnumBrowseDirection_Schema = EnumBrowseDirection_Schema;

exports.BrowseDirection = factories.registerEnumeration(EnumBrowseDirection_Schema);

