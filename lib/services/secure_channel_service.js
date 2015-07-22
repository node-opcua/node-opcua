require("requirish")._(module);

// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The ClientSecureChannelLayer Services allow
// the Client and Server to securely negotiate the keys to use.

var _ = require("underscore");

var factories = require("lib/misc/factories");

var AsymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_AsymmetricAlgorithmSecurityHeader").AsymmetricAlgorithmSecurityHeader;
exports.AsymmetricAlgorithmSecurityHeader = AsymmetricAlgorithmSecurityHeader;

var SymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_SymmetricAlgorithmSecurityHeader").SymmetricAlgorithmSecurityHeader;
exports.SymmetricAlgorithmSecurityHeader = SymmetricAlgorithmSecurityHeader;

var SequenceHeader = require("_generated_/_auto_generated_SequenceHeader").SequenceHeader;
exports.SequenceHeader = SequenceHeader;

//xx ChannelService
exports.AcknowledgeMessage = require("_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
exports.HelloMessage = require("_generated_/_auto_generated_HelloMessage").HelloMessage;
exports.ErrorMessage = require("_generated_/_auto_generated_ErrorMessage").ErrorMessage;

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


exports.MessageChunker = require("lib/misc/message_chunker").MessageChunker;

exports.OpenSecureChannelRequest = require("_generated_/_auto_generated_OpenSecureChannelRequest").OpenSecureChannelRequest;
exports.OpenSecureChannelResponse = require("_generated_/_auto_generated_OpenSecureChannelResponse").OpenSecureChannelResponse;
exports.CloseSecureChannelRequest = require("_generated_/_auto_generated_CloseSecureChannelRequest").CloseSecureChannelRequest;
exports.CloseSecureChannelResponse = require("_generated_/_auto_generated_CloseSecureChannelResponse").CloseSecureChannelResponse;

exports.ServiceFault = require("_generated_/_auto_generated_ServiceFault").ServiceFault;

exports.chooseSecurityHeader = require("lib/misc/secure_message_chunk_manager").chooseSecurityHeader;
