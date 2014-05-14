var s = require("../../lib/datamodel/structures");
var should = require("should");


exports.fixture1 = (function(){
    // empty  GetEndpointsResponse

    var zeroNonce = new Buffer(1);
    zeroNonce.writeUInt8(0,0);

    return new s.OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType:   s.SecurityTokenRequestType.ISSUE,
        securityMode:  s.MessageSecurityMode.NONE,
        clientNonce:   zeroNonce,
        requestedLifetime: 300000
    });

})();
