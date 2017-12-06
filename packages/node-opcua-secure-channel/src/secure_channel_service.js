

// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The ClientSecureChannelLayer Services allow
// the Client and Server to securely negotiate the keys to use.

var _ = require("underscore");

var factories = require("node-opcua-factory");

var AsymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").AsymmetricAlgorithmSecurityHeader;
var SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;
var SequenceHeader = require("node-opcua-service-secure-channel").SequenceHeader;

exports.AsymmetricAlgorithmSecurityHeader = AsymmetricAlgorithmSecurityHeader;
exports.SymmetricAlgorithmSecurityHeader = SymmetricAlgorithmSecurityHeader;
exports.SequenceHeader = SequenceHeader;

exports.ErrorMessage = require("node-opcua-service-secure-channel").ErrorMessage;

//xx ChannelService
exports.AcknowledgeMessage = require("node-opcua-transport/_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
exports.HelloMessage = require("node-opcua-transport/_generated_/_auto_generated_HelloMessage").HelloMessage;

//var Padding_Schema = {
//    name: "Padding",
//    id: factories.next_available_id(),
//    fields: [
//        // The number of padding bytes (not including the byte for the PaddingSize).
//        { name: "paddingSize",        fieldType: "Byte" },
//        // Padding added to the end of the message to ensure length of the data to encrypt is an
//        // integer multiple of the encryption block size.
//        // The value of each byte of the padding is equal to PaddingSize.
//        { name: "padding",            fieldType: "Byte*" },
//
//        // The signature for the MessageChunk.
//        // The signature includes the all headers, all message data, the PaddingSize and the Padding.
//        { name: "Signatures",          fieldType: "Byte*" }
//    ]
//};


exports.MessageChunker = require("./message_chunker").MessageChunker;

exports.OpenSecureChannelRequest = require("node-opcua-service-secure-channel").OpenSecureChannelRequest;
exports.OpenSecureChannelResponse = require("node-opcua-service-secure-channel").OpenSecureChannelResponse;
exports.CloseSecureChannelRequest = require("node-opcua-service-secure-channel").CloseSecureChannelRequest;
exports.CloseSecureChannelResponse = require("node-opcua-service-secure-channel").CloseSecureChannelResponse;

exports.ServiceFault = require("node-opcua-service-secure-channel").ServiceFault;

exports.chooseSecurityHeader = require("./secure_message_chunk_manager").chooseSecurityHeader;
