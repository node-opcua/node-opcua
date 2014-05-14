// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The ClientSecureChannelLayer Services allow
// the Client and Server to securely negotiate the keys to use.

var util = require("util");
var assert = require('better-assert');
var factories = require("./../misc/factories");
var BinaryStream = require("./../misc/binaryStream").BinaryStream;
var ec = require("./../encode_decode");


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
        { name:"senderCertificate" ,             fieldType:"ByteString"  },

        // The thumbprint of the X509v3 certificate assigned to the receiving application
        // The thumbprint is the SHA1 digest of the DER encoded form of the certificate.
        // This indicates what public key was used to encrypt the MessageChunk
        // This field shall be null if the message is not encrypted.
        { name:"receiverCertificateThumbprint" , fieldType:"ByteString"}
    ]
};
var AsymmetricAlgorithmSecurityHeader = exports.AsymmetricAlgorithmSecurityHeader = factories.registerObject(AsymmetricAlgorithmSecurityHeader_Schema);


// Symmetric algorithms are used to secure all messages other than the OpenSecureChannel messages
// OPC UA Secure Conversation Message Header : Part 6 page 37
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
var SymmetricAlgorithmSecurityHeader = exports.SymmetricAlgorithmSecurityHeader = factories.registerObject(SymmetricAlgorithmSecurityHeader_Schema);


var SequenceHeader_Schema = {
    name: "SequenceHeader",
    id: factories.next_available_id(),
    fields: [
        // A monotonically increasing sequence number assigned by the sender to each
        // MessageChunk sent over the ClientSecureChannelLayer.
        { name: "sequenceNumber",    fieldType: "UInt32" },
        // An identifier assigned by the client to OPC UA request Message. All MessageChunks for
        // the request and the associated response use the same identifier.
        { name: "requestId",          fieldType: "UInt32" }
    ]
};
var SequenceHeader = exports.SequenceHeader = factories.registerObject(SequenceHeader_Schema);


var Padding_Schema = {
    name: "Padding",
    id: factories.next_available_id(),
    fields: [
        // The number of padding bytes (not including the byte for the PaddingSize).
        { name: "paddingSize",        fieldType: "Byte" },
        // Padding added to the end of the message to ensure length of the data to encrypt is an
        // integer multiple of the encryption block size.
        // The value of each byte of the padding is equal to PaddingSize.
        { name: "padding",            fieldType: "Byte*" },

        // The signature for the MessageChunk.
        // The signature includes the all headers, all message data, the PaddingSize and the Padding.
        { name: "Signatures",          fieldType: "Byte*" }
    ]
};


//function calculateMaxBodySize() {
//    // The formula to calculate the amount of padding depends on the amount of data that needs to
//    // be sent (called BytesToWrite). The sender shall first calculate the maximum amount of space
//    // available in the MessageChunk (called MaxBodySize) using the following formula:
//    //     MaxBodySize = PlainTextBlockSize * Floor((MessageChunkSize –
//    //                   HeaderSize – SignatureSize - 1)/CipherTextBlockSize) –
//    //                   SequenceHeaderSize;
//
//}


var MessageChunkManager = require("./../misc/chunk_manager").MessageChunkManager;

var SequenceNumberGenerator = require("../misc/sequence_number_generator").SequenceNumberGenerator;


function makeAlgorithmSecurityHeader(/*msgType*/) {

    var securityHeader = new AsymmetricAlgorithmSecurityHeader();

    securityHeader.securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
    securityHeader.senderCertificate = null;
    securityHeader.receiverCertificateThumbprint = null;

    return securityHeader;

}
function chooseSecurityHeader(msgType) {

    var securityHeader = (msgType === "OPN") ?
        new AsymmetricAlgorithmSecurityHeader() :
        new SymmetricAlgorithmSecurityHeader();
    return securityHeader;
}

exports.chooseSecurityHeader = chooseSecurityHeader;


var SecureMessageChunkManager = function (msgType, options, securityHeader,sequenceNumberGenerator) {

    msgType = msgType || "OPN";

    this.chunkSize      = options.chunkSize || 8192;
    var secureChannelId = options.secureChannelId;
    var requestId       = options.requestId;

    this.sequenceNumberGenerator = sequenceNumberGenerator;

    securityHeader = securityHeader || chooseSecurityHeader(msgType);
    this.securityHeader = securityHeader;

    assert(requestId >0 , "expecting a valid request ID");

    this.sequenceHeader  = new SequenceHeader({ requestId: requestId, sequenceNumber: -1});

    var securityHeaderSize = this.securityHeader.binaryStoreSize();
    var sequenceHeaderSize = this.sequenceHeader.binaryStoreSize();

    var extraHeaderSize = securityHeaderSize + sequenceHeaderSize;
    MessageChunkManager.call(this, this.chunkSize,msgType,secureChannelId,extraHeaderSize);

    assert(this.bodySize > 0);

};
util.inherits(SecureMessageChunkManager, MessageChunkManager);


SecureMessageChunkManager.prototype.write_header_and_footer = function(finalC,buf,length) {

    assert(finalC.length === 1);
    assert(buf instanceof Buffer);

    var bs = new BinaryStream(buf);

    // message header --------------------------

    // ---------------------------------------------------------------
    // OPC UA Secure Conversation Message Header : Part 6 page 36
    // MessageType     Byte[3]
    // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
    // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
    // SecureChannelId UInt32   A unique identifier for the ClientSecureChannelLayer assigned by the server.

    bs.writeUInt8(this.msgType.charCodeAt(0));
    bs.writeUInt8(this.msgType.charCodeAt(1));
    bs.writeUInt8(this.msgType.charCodeAt(2));
    bs.writeUInt8(finalC.charCodeAt(0));

    bs.writeUInt32(length);
    bs.writeUInt32(this.secureChannelId);

    assert(bs.length === 12 );

    // write Security Header -----------------
    this.securityHeader.encode(bs);


    // write Sequence Header -----------------
    this.sequenceHeader.sequenceNumber = this.sequenceNumberGenerator.next();
    this.sequenceHeader.encode(bs);

    assert(bs.length === this.sizeOfHeader);

    //  body + padding already written

    // sign

    // write signature

    // encrypt
    //xx console.log(this.securityHeader);
    //xx console.log(this.sequenceHeader);
};

/**
 * wrap a message body into one or more message_chunks
 * (  use this method to build fake data blocks in tests)
 * @param message_body
 * @param msgType
 * @param chunk_size
 * @returns {Array}
 */
function decompose_message_body_in_chunks(message_body,msgType,chunk_size) {

    assert(chunk_size>24,"expecting chunk_size");
    assert(msgType.length===3," invalid msgType "+ msgType);
    assert(message_body instanceof Buffer && message_body.length >0 , " invalid buffer");

    var sequenceNumberGenerator = new SequenceNumberGenerator();

    var options = {
        secureChannelId: 10,
        requestId: 36
    };

    var msgChunkManager = new SecureMessageChunkManager(msgType,options,null,sequenceNumberGenerator);
    var chunks = [];
    msgChunkManager.on("chunk",function(chunk){
        if(chunk) {
            assert(chunk.length>0);
            chunks.push(chunk);
        }
    });
    msgChunkManager.write(message_body);
    msgChunkManager.end();
    assert(chunks.length>0,"decompose_message_body_in_chunks: must produce at least one chunk");
    return chunks;
}
exports.decompose_message_body_in_chunks = decompose_message_body_in_chunks;



function clone_buffer(buffer) {
    var clone = new Buffer(buffer.length);
    buffer.copy(clone,0,0);
    return clone;
}
exports.clone_buffer = clone_buffer;


function MessageChunker() {
    this.sequenceNumberGenerator = new SequenceNumberGenerator();
}


MessageChunker.prototype.chunkSecureMessage = function(msgType,options,message,messageChunkCallback) {

    var chunkStream = require("./../misc/chunk_manager").chunkStream;

    // calculate message size ( with its  encodingDefaultBinary)
    var binSize = message.binaryStoreSize() + 4;

    var stream = new BinaryStream(binSize);

    ec.encodeExpandedNodeId(message.encodingDefaultBinary,stream);
    message.encode(stream);

    exports.fullbuf = clone_buffer(stream._buffer);

    var r = require("stream").Readable();
    r.push(stream._buffer);
    r.push(null);

    var securityHeader;
    if (msgType === "OPN") {
        securityHeader = makeAlgorithmSecurityHeader();
    } else {
        securityHeader = new SymmetricAlgorithmSecurityHeader({
            tokenId: options.tokenId
        });
    }
    r.pipe(chunkStream(new SecureMessageChunkManager(msgType, options, securityHeader,this.sequenceNumberGenerator))
    ).on("data",function (messageChunk) {
        messageChunkCallback(messageChunk);
    }).on("finish",function(){
        messageChunkCallback(null);
    });
};

exports.MessageChunker = MessageChunker;
