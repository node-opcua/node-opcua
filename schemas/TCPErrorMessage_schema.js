"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// TCP Error Message  OPC Unified Architecture, Part 6 page 46
// the server always close the connection after sending the TCPError message
var TCPErrorMessage_Schema = {
    name: "TCPErrorMessage",
    id: factories.next_available_id(),
    fields: [
        { name: "statusCode", fieldType: "StatusCode"},
        { name: "reason", fieldType: "String"} // A more verbose description of the error.
    ]

};
exports.TCPErrorMessage_Schema = TCPErrorMessage_Schema;
