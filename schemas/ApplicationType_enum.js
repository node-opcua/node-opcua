"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var ApplicationType_Schema = {
    name: "ApplicationType",
    enumValues: {
        SERVER: 0, // The application is a Server
        CLIENT: 1, // The application is a Client
        CLIENTANDSERVER: 2, // The application is a Client and a Server
        DISCOVERYSERVER: 3  // The application is a DiscoveryServer
    }
};
exports.ApplicationType = factories.registerEnumeration(ApplicationType_Schema);