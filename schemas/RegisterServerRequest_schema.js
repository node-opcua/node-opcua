

var RegisterServerRequest_Schema = {
    documentation:"Registers a server with the discovery server.",
    name: "RegisterServerRequest",
    fields: [
        { name:"requestHeader",               fieldType:"RequestHeader",   documentation: "A standard header included in all requests sent to a server."},
        { name:"server",                      fieldType:"RegisteredServer", documentation: "The server to register."}
    ]
};
exports.RegisterServerRequest_Schema = RegisterServerRequest_Schema;
