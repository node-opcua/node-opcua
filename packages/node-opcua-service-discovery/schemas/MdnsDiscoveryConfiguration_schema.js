"use strict";
require("node-opcua-data-model");
require("node-opcua-service-endpoints");
const factories = require("node-opcua-factory");

const MdnsDiscoveryConfiguration_Schema = {
    documentation: "mDNS discovery configuration.",
    name: "MdnsDiscoveryConfiguration",
    fields: [
        {
            name: "mdnsServerName",
            fieldType:"String",
            documentation:"The name of the Server when it is announced via mDNS. See Part 12 for\n" +
            "the details about mDNS.\n" +
            "This string shall be less than 64 bytes."
        },
        {
            name: "serverCapabilities",
            isArray: true,
            fieldType:"String",
            documentation: "The set of server capabilities supported by the Server.\n" +
            "A server capability is a short identifier for a feature\n" +
            "The set of allowed server capabilities are defined in Part 12."
        }
    ]

};
exports.MdnsDiscoveryConfiguration_Schema = MdnsDiscoveryConfiguration_Schema;

