"use strict";
require("requirish")._(module);

var factories = require("lib/misc/factories");

// OPC Unified Architecture, Part 4  $7.29 page 139
var SessionAuthenticationToken_Schema = {
    name: "SessionAuthenticationToken",
    subtype: "NodeId"
};
factories.registerBasicType(SessionAuthenticationToken_Schema);

