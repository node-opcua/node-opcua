var factories = require("../lib/misc/factories");

// OPC UA Secure Conversation Message Header : Part 6 page 36

//Asymmetric algorithms are used to secure the OpenSecureChannel messages.
var AsymmetricAlgorithmSecurityHeader_Schema = {
    name: "AsymmetricAlgorithmSecurityHeader",
    id: factories.next_available_id(),
    fields: [
        // length shall not exceed 256
        // The URI of the security policy used to secure the message.
        // This field is encoded as a UTF8 string without a null terminator
        { name:"securityPolicyUri" ,              fieldType:"String"  },

        // The X509v3 certificate assigned to the sending application instance.
        // This is a DER encoded blob.
        // This indicates what private key was used to sign the MessageChunk.
        // This field shall be null if the message is not signed.
        { name:"senderCertificate" ,             fieldType:"ByteString", defaultValue: null },

        // The thumbprint of the X509v3 certificate assigned to the receiving application
        // The thumbprint is the SHA1 digest of the DER encoded form of the certificate.
        // This indicates what public key was used to encrypt the MessageChunk
        // This field shall be null if the message is not encrypted.
        { name:"receiverCertificateThumbprint" , fieldType:"ByteString", defaultValue: null}
    ]
};
exports.AsymmetricAlgorithmSecurityHeader_Schema = AsymmetricAlgorithmSecurityHeader_Schema;