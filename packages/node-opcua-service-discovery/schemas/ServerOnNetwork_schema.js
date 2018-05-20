require("node-opcua-service-secure-channel");
require("node-opcua-data-model");

const ServerOnNetwork_Schema = {
        documentation: "",
        name: "ServerOnNetwork",
        fields: [
            {
                name: "recordId",
                fieldType: "UInt32",
                documentation: "A unique identifier for the record.\n" +
                "This can be used to fetch the next batch of Servers in a subsequent\n" +
                "call to FindServersOnNetwork"
            },
            {
                name: "serverName",
                fieldType: "String",
                documentation: "The name of the Server specified in the mDNS announcement " +
                "(see Part 12).This may be the same as the ApplicationName for the Server."
            },
            {
                name: "discoveryUrl",
                fieldType: "String",
                documentation: "The URL of the discovery Endpoint."
            },
            {
                name: "serverCapabilities",
                isArray: true,
                fieldType: "String",
                documentation: "The set of Server capabilities supported by the Server." +
                "The set of allowed Server capabilities are defined in Part 12"
            }
        ]
    }
;
exports.ServerOnNetwork_Schema = ServerOnNetwork_Schema;
