"use strict";

const factories = require("node-opcua-factory");

const EnumSecurityTokenRequestType_Schema = {
    name: "SecurityTokenRequestType",
    enumValues: {
        ISSUE: 0, //  creates a new SecurityToken for a new ClientSecureChannelLayer
        RENEW: 1  //  creates a new SecurityToken for an existing ClientSecureChannelLayer .
    }
};
exports.SecurityTokenRequestType = factories.registerEnumeration(EnumSecurityTokenRequestType_Schema);