require("requirish")._(module);
var s = require("lib/datamodel/structures");

var secure_channel_service = require("lib/services/secure_channel_service");
var OpenSecureChannelRequest = secure_channel_service.OpenSecureChannelRequest;

var should = require("should");


exports.fixture1 = (function(){
    // empty  GetEndpointsResponse

    var zeroNonce = new Buffer(1);
    zeroNonce.writeUInt8(0,0);

    return new OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType:   s.SecurityTokenRequestType.ISSUE,
        securityMode:  s.MessageSecurityMode.NONE,
        clientNonce:   zeroNonce,
        requestedLifetime: 300000
    });

})();
