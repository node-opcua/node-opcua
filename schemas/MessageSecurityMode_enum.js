"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// see part 4 $7.14
var EnumMessageSecurityMode_Schema = {
    name: "EnumMessageSecurityMode",
    enumValues: {
        INVALID: 0, // The MessageSecurityMode is invalid
        NONE: 1, // No security is applied.
        SIGN: 2, // All messages are signed but not encrypted.
        SIGNANDENCRYPT: 3  // All messages are signed and encrypted.
    }
};
exports.EnumMessageSecurityMode_Schema = EnumMessageSecurityMode_Schema;
exports.MessageSecurityMode = factories.registerEnumeration(EnumMessageSecurityMode_Schema);
