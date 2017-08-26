"use strict";

var secure_channel_service = require("$node-opcua/services/secure_channel_service");
var OpenSecureChannelRequest = secure_channel_service.OpenSecureChannelRequest;
require("should");


exports.fixture1 = (function () {
    // empty  GetEndpointsResponse

    var zeroNonce = new Buffer(1);
    zeroNonce.writeUInt8(0, 0);

    return new OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType: s.SecurityTokenRequestType.ISSUE,
        securityMode: s.MessageSecurityMode.NONE,
        clientNonce: zeroNonce,
        requestedLifetime: 300000
    });

})();
