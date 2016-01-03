"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// see part 4 $7.14
var MessageSecurityMode_Schema = {
    name: "MessageSecurityMode",
    enumValues: {
        INVALID: 0, // The MessageSecurityMode is invalid
        NONE: 1, // No security is applied.
        SIGN: 2, // All messages are signed but not encrypted.
        SIGNANDENCRYPT: 3  // All messages are signed and encrypted.
    }
};
exports.MessageSecurityMode_Schema = MessageSecurityMode_Schema;
exports.MessageSecurityMode = factories.registerEnumeration(MessageSecurityMode_Schema);
