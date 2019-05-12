"use strict";

const secure_channel_service = require("$node-opcua/services/secure_channel_service");
const OpenSecureChannelRequest = secure_channel_service.OpenSecureChannelRequest;
require("should");


exports.fixture1 = (function () {
    // empty  GetEndpointsResponse

    const zeroNonce = Buffer.alloc(1);
    zeroNonce.writeUInt8(0, 0);

    return new OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType: secure_channel_service.SecurityTokenRequestType.Issue,
        securityMode: secure_channel_service.MessageSecurityMode.None,
        clientNonce: zeroNonce,
        requestedLifetime: 300000
    });

})();
