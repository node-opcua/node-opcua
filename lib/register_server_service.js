var s = require("./structures");

var factories = require("./factories");



var RegisterServerRequest_Schema = {
    comment:"Registers a server with the discovery server.",
    name: "RegisterServerRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"server",                      fieldType:"RegisteredServer", documentation: "The server to register."},
    ]
};
var RegisterServerRequest = exports.RegisterServerRequest = factories.registerObject(RegisterServerRequest_Schema);


var RegisteredServer_Schema = {
    comment:"The information required to register a server with a discovery server.",
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
        {name:"isOnline",                     fieldType:"Boolean" ,        documentation:"If FALSE the server will save the registration information to a persistent datastore." },

    ]
};
var RegisteredServer = exports.RegisteredServer =  factories.registerObject(RegisteredServer_Schema);



var RegisterServerResponse_Schema = {
    comment:" A standard header included in all responses returned by servers.",
    name: "RegisterServerResponse",
    fields: [
        { name:"responseHeader",                           fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."},
    ]
};

var RegisterServerResponse = exports.RegisterServerResponse =  factories.registerObject(RegisterServerResponse_Schema);




// ----------------------------------------------------
// Discovery :  FindServers
// ----------------------------------------------------



var FindServersRequest_Schema = {
    comment:"Finds the servers known to the discovery server.",
    name: "FindServersRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"endpointUrl",                 fieldType:"String",          documentation: "The URL used by the client to send the request."},
        { name:"localeIds",    isArray:true,  fieldType:"LocaleId",        documentation: "The locales to use when constructing a response."},
        { name:"serverUris",   isArray:true,  fieldType:"String",         documentation: "The URIs of the servers to return (all servers returned if none specified)."},
    ]
};
var FindServersRequest = exports.FindServersRequest =  factories.registerObject(FindServersRequest_Schema);


var FindServersResponse_Schema = {
    comment:" A standard header included in all responses returned by servers.",
    name: "FindServersResponse",
    fields: [
        { name:"responseHeader",                           fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."},
        { name:"servers",    isArray:true,                 fieldType:"ApplicationDescription",         documentation: "The servers that met the criteria specified in the request."}
    ]
};
var FindServersResponse = exports.FindServersResponse =  factories.registerObject(FindServersResponse_Schema);

