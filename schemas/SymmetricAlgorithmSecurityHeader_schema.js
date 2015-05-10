"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// Symmetric algorithms are used to secure all messages other than the OpenSecureChannel messages
// OPC UA Secure Conversation Message Header Release 1.02 Part 6 page 39
var SymmetricAlgorithmSecurityHeader_Schema= {
    name: "SymmetricAlgorithmSecurityHeader",
    id: factories.next_available_id(),
    fields: [
        // A unique identifier for the ClientSecureChannelLayer token used to secure the message
        // This identifier is returned by the server in an OpenSecureChannel response message. If a
        // Server receives a TokenId which it does not recognize it shall return an appropriate
        // transport layer error.
        { name: "tokenId"   , fieldType: "UInt32" , defaultValue: 0xDEADBEEF }
    ]
};
exports.SymmetricAlgorithmSecurityHeader_Schema = SymmetricAlgorithmSecurityHeader_Schema;