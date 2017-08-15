require("node-opcua-service-secure-channel");
require("node-opcua-data-model");

var FindServersResponse_Schema = {
    documentation:" A standard header included in all responses returned by servers.",
    name: "FindServersResponse",
    fields: [
        { name:"responseHeader",                           fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."},
        { name:"servers",    isArray:true,                 fieldType:"ApplicationDescription",         documentation: "The servers that met the criteria specified in the request."}
    ]
};
exports.FindServersResponse_Schema = FindServersResponse_Schema;