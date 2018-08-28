"use strict";

const factories = require("node-opcua-factory");

const EnumSecurityTokenRequestType_Schema = {
    name: "SecurityTokenRequestType",
    enumValues: {
        Issue: 0, //  creates a new SecurityToken for a new ClientSecureChannelLayer
        Renew: 1  //  creates a new SecurityToken for an existing ClientSecureChannelLayer .
    }
};
exports.SecurityTokenRequestType = factories.registerEnumeration(EnumSecurityTokenRequestType_Schema);