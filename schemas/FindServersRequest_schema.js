var FindServersRequest_Schema = {
    documentation:"Finds the servers known to the discovery server.",
    name: "FindServersRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"endpointUrl",                 fieldType:"String",          documentation: "The URL used by the client to send the request."},
        { name:"localeIds",    isArray:true,  fieldType:"LocaleId",        documentation: "The locales to use when constructing a response."},
        { name:"serverUris",   isArray:true,  fieldType:"String",         documentation: "The URIs of the servers to return (all servers returned if none specified)."}
    ]
};
exports.FindServersRequest_Schema = FindServersRequest_Schema;