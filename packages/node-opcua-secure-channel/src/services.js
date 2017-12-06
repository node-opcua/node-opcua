"use strict";

module.exports = {

    OpenSecureChannelRequest: require("node-opcua-service-secure-channel").OpenSecureChannelRequest,
    OpenSecureChannelResponse: require("node-opcua-service-secure-channel").OpenSecureChannelResponse,
    CloseSecureChannelRequest: require("node-opcua-service-secure-channel").CloseSecureChannelRequest,
    CloseSecureChannelResponse: require("node-opcua-service-secure-channel").CloseSecureChannelResponse,
    ServiceFault: require("node-opcua-service-secure-channel").ServiceFault,
    AsymmetricAlgorithmSecurityHeader: require("node-opcua-service-secure-channel").AsymmetricAlgorithmSecurityHeader,
    MessageSecurityMode: require("node-opcua-service-secure-channel").MessageSecurityMode,
    SecurityTokenRequestType: require("node-opcua-service-secure-channel").SecurityTokenRequestType,
    ChannelSecurityToken: require("node-opcua-service-secure-channel").ChannelSecurityToken,
    ResponseHeader: require("node-opcua-service-secure-channel").ResponseHeader,
    RequestHeader: require("node-opcua-service-secure-channel").RequestHeader,

    SecurityPolicy: require("../src/security_policy").SecurityPolicy,
    AcknowledgeMessage: require("node-opcua-transport/_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage,

    SignatureData: require("node-opcua-service-secure-channel").SignatureData
};


module.exports = require("node-opcua-service-secure-channel");



