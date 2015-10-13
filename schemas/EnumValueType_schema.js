"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// OPCUA 1.03 : Part 3  $ 8.40 page 65

// This Structured DataType is used to represent a human-readable representation of an Enumeration.
// When this type is used in an array representing human-readable representations of an enumeration,
// each Value shall be unique in that array.

var EnumValueType_Schema = {
    name: "EnumValueType",
    fields: [
        {
            name: "value",
            fieldType: "Int64",
            documentation: "The Integer representation of an Enumeration."
        },
        {
            name: "displayName",
            fieldType: "LocalizedText",
            documentation: "A human-readable representation of the Value of the Enumeration."
        },
        {
            name: "description",
            fieldType: "LocalizedText",
            documentation: "A localized description of the enumeration value. This field can contain an empty string if no description is available"
        }
    ]
};
exports.EnumValueType_Schema = EnumValueType_Schema;
