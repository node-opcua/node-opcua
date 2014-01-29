// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The SecureChannel Services allow
// the Client and Server to securely negotiate the keys to use.

var crypto = require("crypto");
var util = require("util");
var assert = require("assert");
var color = require("colors");

var factories = require("./factories");
var BinaryStream = require("./binaryStream").BinaryStream;
var s= require("./structures");
var ec = require("./encode_decode");

function makeToken()
{
    return crypto.randomBytes(64).toString('base64')
}

function SecureChannel()
{

}

exports.SecureChannel = SecureChannel();

// OPC UA Secure Conversation Message Header : Part 6 page 36
var AsymmetricAlgorithmSecurityHeader_Description = {
    name: "AsymmetricAlgorithmSecurityHeader",
    id: 0xFFFFF1,
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
exports.AsymmetricAlgorithmSecurityHeader= factories.UAObjectFactoryBuild(AsymmetricAlgorithmSecurityHeader_Description);


// OPC UA Secure Conversation Message Header : Part 6 page 37
var SymmetricAlgorithmSecurityHeader_Description= {
    name: "SymmetricAlgorithmSecurityHeader",
    fields: [
        // A unique identifier for the SecureChannel token used to secure the message
        // This identifier is returned by the server in an OpenSecureChannel response message. If a
        // Server receives a TokenId which it does not recognize it shall return an appropriate
        // transport layer error.
        { name: "tokenId"   , fieldType: "UInt32"}
    ]
};
exports.SymmetricAlgorithmSecurityHeader = factories.UAObjectFactoryBuild(SymmetricAlgorithmSecurityHeader_Description);


var SequenceHeader_Description = {
    name: "SequenceHeader",
    fields: [
        // A monotonically increasing sequence number assigned by the sender to each
        // MessageChunk sent over the SecureChannel.
        { name: "sequenceNumber",    fieldType: "UInt32" },
        // An identifier assigned by the client to OPC UA request Message. All MessageChunks for
        // the request and the associated response use the same identifier.
        { name: "requestId",          fieldType: "UInt32" }
    ]
};
exports.SequenceHeader = SequenceHeader = factories.UAObjectFactoryBuild(SequenceHeader_Description);


var Padding_Description = {
    name: "Padding",
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


function calculateMaxBodySize() {
    // The formula to calculate the amount of padding depends on the amount of data that needs to
    // be sent (called BytesToWrite). The sender shall first calculate the maximum amount of space
    // available in the MessageChunk (called MaxBodySize) using the following formula:
    //     MaxBodySize = PlainTextBlockSize * Floor((MessageChunkSize –
    //                   HeaderSize – SignatureSize - 1)/CipherTextBlockSize) –
    //                   SequenceHeaderSize;

}




var MessageChunkManager = require("./chunk_manager").MessageChunkManager;


var SequenceNumberGenerator = require("./sequence_number_generator").SequenceNumberGenerator;
var sequenceNumberGenerator = new SequenceNumberGenerator();


var AsymmetricAlgorithmSecurityHeader = require("./secure_channel_service").AsymmetricAlgorithmSecurityHeader;
function makeAlgorithmSecurityHeader() {

    var securityHeader = new AsymmetricAlgorithmSecurityHeader();

    securityHeader.securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
    securityHeader.senderCertificate = null;
    securityHeader.receiverCertificateThumbprint = null;

    return securityHeader;

}

var SecureMessageChunkManager = function(msgType,requestId,securityHeader)
{
    var secureChannelId = 0;
    msgType = msgType || "OPN";

    this.chunkSize = 8192;

    securityHeader = securityHeader || makeAlgorithmSecurityHeader();
    this.securityHeader = securityHeader;

    this.sequenceHeader  = new SequenceHeader({ requestId: requestId,sequenceNumber: -1});

    var securityHeaderSize =this.securityHeader.binaryStoreSize();
    var sequenceHeaderSize = this.sequenceHeader.binaryStoreSize();

    extraHeaderSize   = securityHeaderSize + sequenceHeaderSize;
    MessageChunkManager.call(this, this.chunkSize,msgType,secureChannelId,extraHeaderSize);


    assert(this.bodySize > 0);

    //xx console.log(" packet body size ",(this.bodySize)," offset  body ",(this.sizeOfHeader));

};


util.inherits(SecureMessageChunkManager, MessageChunkManager);


SecureMessageChunkManager.prototype.write_header_and_footer = function(finalC,buf,length) {

    assert(finalC.length === 1);
    // reserve space for header
    var self = this;
    assert(buf instanceof Buffer);

    var bs = new BinaryStream(buf);

    // message header --------------------------

    // ---------------------------------------------------------------
    // OPC UA Secure Conversation Message Header : Part 6 page 36
    // MessageType     Byte[3]
    // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
    // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
    // SecureChannelId UInt32   A unique identifier for the SecureChannel assigned by the server.

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
    this.sequenceHeader.sequenceNumber = sequenceNumberGenerator.next();
    this.sequenceHeader.encode(bs);

    assert(bs.length === this.sizeOfHeader);

    //  body + padding already written

    // sign

    // write signature

    // encrypt

};

function clone_buffer(buffer) {
    var clone = new Buffer(buffer.length);
    buffer.copy(clone,0,0);
    return clone;
}
exports.clone_buffer = clone_buffer;

function chunkSecureMessage(msgType,requestId,message,messageChunkCallback) {

    var ChunkStream = require("./chunk_manager").ChunkStream;

    // calculate message size
    var binSize = message.binaryStoreSize() + 4;

    var stream = new BinaryStream(binSize);

    ec.encodeExpandedNodeId(message.encodingDefaultBinary,stream);
    message.encode(stream);

    exports.fullbuf = clone_buffer(stream._buffer);


    var r = require("stream").Readable();
    r.push(stream._buffer);
    r.push(null);


    r.pipe(ChunkStream(new SecureMessageChunkManager(msgType,requestId))).on("data",function(messageChunk) {
        messageChunkCallback(messageChunk);
    }).on("finish",function(){
        messageChunkCallback(null);
    });
}

exports.chunkSecureMessage = chunkSecureMessage;


var MessageBuilderBase = require("./chunk_manager").MessageBuilderBase;

var MessageBuilder = function() {

    MessageBuilderBase.call(this);
    this.previous_sequenceNumber = -1;
};

util.inherits(MessageBuilder, MessageBuilderBase);

MessageBuilder.prototype._validateSequenceNumber=function(sequenceNumber) {

    // checking that sequenceNumber is increasing
    if (this.previous_sequenceNumber !== -1) {
        if( this.previous_sequenceNumber +1 !=sequenceNumber ) {
            throw Error("Invalid Sequence Number found ")
        }
        // todo : handle the case where sequenceNumber wraps back to < 1024
    }
    this.previous_sequenceNumber =sequenceNumber;
};


MessageBuilder.prototype._read_headers = function(binaryStream) {

    this.securityHeader = new AsymmetricAlgorithmSecurityHeader();
    this.sequenceHeader = new SequenceHeader();

    this.securityHeader.decode(binaryStream);
    this.sequenceHeader.decode(binaryStream);

    this._validateSequenceNumber(this.sequenceHeader.sequenceNumber);
};


MessageBuilder.prototype._on_raw_buffer = function(buffer) {

    var binaryStream = new BinaryStream(buffer);

    // read expandedNodeId:
    var id = ec.decodeExpandedNodeId(binaryStream);

    // construct the object
    var objMessage = factories.constructObject(id);

    //xx console.log(" constructing a "+ objMessage._description.name);

    // de-serialize the object from the binary stream
    objMessage.decode(binaryStream);

    this.emit("message",objMessage);
};
exports.MessageBuilder = MessageBuilder;

