"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var ErrorMessage_Schema = {
    name: "ErrorMessage",
    id: factories.next_available_id(),
    fields: [
        {
            name: "Error",
            fieldType: "UInt32",
            documentation: "The numeric code for the error. This shall be one of the values listed in Table 40."
        },
        {
            name: "Reason",
            fieldType: "String",
            documentation: "A more verbose description of the error.This string shall not be more than 4096 characters."
        }
    ]
};
exports.ErrorMessage_Schema = ErrorMessage_Schema;
