"use strict";

const { OpenSecureChannelRequest, MessageSecurityMode, SecurityTokenRequestType } = require("node-opcua-types");
require("should");

exports.fixture1 = (function () {
    // empty  GetEndpointsResponse

    const zeroNonce = Buffer.alloc(1);
    zeroNonce.writeUInt8(0, 0);

    return new OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType: SecurityTokenRequestType.Issue,
        securityMode: MessageSecurityMode.None,
        clientNonce: zeroNonce,
        requestedLifetime: 300000
    });
})();
