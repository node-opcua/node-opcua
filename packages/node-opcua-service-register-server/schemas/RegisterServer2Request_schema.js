require("node-opcua-service-secure-channel");
require("node-opcua-data-model");


const RegisterServer2Request_Schema = {
    documentation: "Registers a server with the discovery server.",
    name: "RegisterServer2Request",
    fields: [
        {
            name: "requestHeader",
            fieldType: "RequestHeader",
            documentation: "A standard header included in all requests sent to a server."
        },
        {name: "server", fieldType: "RegisteredServer", documentation: "The server to register."},
        {
            name: "discoveryConfiguration",
            isArray: true,
            fieldType: "ExtensionObject",
            //fieldType: "ExtensibleParameter", // DiscoveryConfiguration
            documentation: "Additional configuration settings for the Server to register.\n" +
            "The DiscoveryConfiguration is an extensible parameter type defined\n" +
            "in 7.9."
        }
    ]
};
exports.RegisterServer2Request_Schema = RegisterServer2Request_Schema;
