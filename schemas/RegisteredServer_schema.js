"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var RegisteredServer_Schema = {
    documentation:"The information required to register a server with a discovery server.",
    name: "RegisteredServer",
    id: factories.next_available_id(),
    fields: [
        {name:"serverUri",                    fieldType:"String",          documentation:"The globally unique identifier for the server." },
        {name:"productUri",                   fieldType:"String",          documentation:"The globally unique identifier for the product." },
        {name:"serverNames", isArray:true,    fieldType:"LocalizedText",   documentation:"The name of server in multiple lcoales." },
        {name:"serverType",                   fieldType:"ApplicationType", documentation:"The type of server." },
        {name:"gatewayServerUri",             fieldType:"String" ,         documentation:"The globally unique identifier for the server that is acting as a gateway for the server." },
        {name:"discoveryUrls", isArray:true,  fieldType:"String" ,         documentation:"The URLs for the server's discovery endpoints." },
        {name:"semaphoreFilePath",            fieldType:"String" ,         documentation:"A path to a file that is deleted when the server is no longer accepting connections." },
        {name:"isOnline",                     fieldType:"Boolean" ,        documentation:"If FALSE the server will save the registration information to a persistent datastore." }

    ]
};
exports.RegisteredServer_Schema = RegisteredServer_Schema;