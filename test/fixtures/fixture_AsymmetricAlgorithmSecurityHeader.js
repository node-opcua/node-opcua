
var s = require("../../lib/datamodel/structures");
var sc= require("../../lib/services/secure_channel_service");

exports.fixture1 = (function(){

    var securityHeader = new sc.AsymmetricAlgorithmSecurityHeader();
    securityHeader.securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
    securityHeader.senderCertificate = new Buffer(0);
    securityHeader.receiverCertificateThumbprint = new Buffer(0);

    return securityHeader;
})();
