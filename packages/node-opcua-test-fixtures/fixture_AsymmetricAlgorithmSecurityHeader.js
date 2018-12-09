

var sc = require("node-opcua-service-secure-channel");

exports.fixture1 = (function () {

    var securityHeader = new sc.AsymmetricAlgorithmSecurityHeader();
    securityHeader.securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
    securityHeader.senderCertificate = Buffer.alloc(0);
    securityHeader.receiverCertificateThumbprint = Buffer.alloc(0);

    return securityHeader;
})();
