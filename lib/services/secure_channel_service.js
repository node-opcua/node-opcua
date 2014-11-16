// A SecureChannel is a long-running logical connection between a single Client and a single Server.
// This channel maintains a set of keys known only to the Client and Server, which are used to
// authenticate and encrypt Messages sent across the network. The ClientSecureChannelLayer Services allow
// the Client and Server to securely negotiate the keys to use.

var util = require("util");
var assert = require('better-assert');
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;

var factories = require("./../misc/factories");
var BinaryStream = require("./../misc/binaryStream").BinaryStream;
var ec = require("./../misc/encode_decode");
var s = require("./../datamodel/structures");

var ChunkManager = require("./../misc/chunk_manager").ChunkManager;

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
exports.AsymmetricAlgorithmSecurityHeader_Schema = AsymmetricAlgorithmSecurityHeader_Schema;
var AsymmetricAlgorithmSecurityHeader = exports.AsymmetricAlgorithmSecurityHeader = factories.registerObject(AsymmetricAlgorithmSecurityHeader_Schema);
exports.AsymmetricAlgorithmSecurityHeader = AsymmetricAlgorithmSecurityHeader;


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
exports.SequenceHeader_Schema = SequenceHeader_Schema;
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




var SequenceNumberGenerator = require("../misc/sequence_number_generator").SequenceNumberGenerator;


function chooseSecurityHeader(msgType) {

    var securityHeader = (msgType === "OPN") ?
        new AsymmetricAlgorithmSecurityHeader() :
        new SymmetricAlgorithmSecurityHeader();
    return securityHeader;
}

exports.chooseSecurityHeader = chooseSecurityHeader;


/**
 * @class SecureMessageChunkManager
 *
 * @param msgType
 * @param options
 * @param options.chunkSize {Integer} [=8192]
 * @param options.secureChannelId
 * @param options.requestId
 * @param options.signatureLength  {Integer}  [undefined]
 * @param options.signingFunc {Function} [undefined]
 *
 * @param securityHeader
 * @param sequenceNumberGenerator
 * @constructor
 */
var SecureMessageChunkManager = function (msgType, options, securityHeader,sequenceNumberGenerator) {

    var self = this;
    self.aborted    = false;

    msgType = msgType || "OPN";

    securityHeader = securityHeader || chooseSecurityHeader(msgType);
    assert(_.isObject(securityHeader));

    // the maximum size of a message chunk:
    self.chunkSize      = options.chunkSize || 8192;
    self.msgType        = msgType;

    options.secureChannelId = options.secureChannelId || 0;
    assert(_.isFinite(options.secureChannelId));
    self.secureChannelId = options.secureChannelId;



    var requestId       = options.requestId;

    self.sequenceNumberGenerator = sequenceNumberGenerator;

    self.securityHeader = securityHeader;

    assert(requestId >0 , "expecting a valid request ID");

    self.sequenceHeader  = new SequenceHeader({ requestId: requestId, sequenceNumber: -1});

    var securityHeaderSize = self.securityHeader.binaryStoreSize();
    var sequenceHeaderSize = self.sequenceHeader.binaryStoreSize();
    assert(sequenceHeaderSize === 8);

    self.headerSize = 12 + securityHeaderSize;

    var params = {
        chunkSize:          self.chunkSize,


        headerSize:         self.headerSize,
        writeHeaderFunc: function(block,isLast,totalLength) {

            var finalC =   isLast ? "F" : "C";
            finalC = this.aborted ? "A" : finalC;
            self.write_header(finalC, block,totalLength);
        },

        sequenceHeaderSize: options.sequenceHeaderSize,
        writeSequenceHeaderFunc: function(block) {
            //xx console.log("s=",block.length," s=",this.sequenceHeaderSize);
            assert(block.length === this.sequenceHeaderSize);
            self.writeSequenceHeader(block);
        },

        // ---------------------------------------- Signing stuff
        signatureLength:    options.signatureLength,
        compute_signature:  options.signingFunc,

        // ---------------------------------------- Encrypting stuff
        plainBlockSize:    options.plainBlockSize,
        cipherBlockSize:   options.cipherBlockSize,
        encrypt_buffer:    options.encrypt_buffer
    };
    self.chunkManager = new ChunkManager(params);

    self.chunkManager.on("chunk", function (chunk,is_last) {
        /**
         * @event chunk
         * @param chunk {Buffer}
         */
        self.emit("chunk", chunk, is_last || self.aborted);

    });
};
// util.inherits(SecureMessageChunkManager, MessageChunkManager);
util.inherits(SecureMessageChunkManager, EventEmitter);



SecureMessageChunkManager.prototype.write_header = function(finalC,buf,length) {

    assert(buf.length > 12);
    assert(finalC.length === 1);
    assert(buf instanceof Buffer);

    var bs = new BinaryStream(buf);

    // message header --------------------------
    var self = this;
    // ---------------------------------------------------------------
    // OPC UA Secure Conversation Message Header : Part 6 page 36
    // MessageType     Byte[3]
    // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
    // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
    // SecureChannelId UInt32   A unique identifier for the ClientSecureChannelLayer assigned by the server.

    bs.writeUInt8(self.msgType.charCodeAt(0));
    bs.writeUInt8(self.msgType.charCodeAt(1));
    bs.writeUInt8(self.msgType.charCodeAt(2));
    bs.writeUInt8(finalC.charCodeAt(0));

    bs.writeUInt32(length);
    bs.writeUInt32(self.secureChannelId);

    assert(bs.length === 12);

    //xx console.log("securityHeader size = ",this.securityHeader.binaryStoreSize());
    // write Security Header -----------------
    this.securityHeader.encode(bs);
    assert(bs.length === this.headerSize);
};

SecureMessageChunkManager.prototype.writeSequenceHeader = function(block)
{
    var bs = new BinaryStream(block);
    // write Sequence Header -----------------
    this.sequenceHeader.sequenceNumber = this.sequenceNumberGenerator.next();
    this.sequenceHeader.encode(bs);
    assert(bs.length === 8);

};

/**
 * @method write
 * @param buffer {Buffer}
 * @param length {Integer} - optional if not provided  buffer.length is used instead.
 */
SecureMessageChunkManager.prototype.write = function (buffer, length) {
    length = length || buffer.length;
    this.chunkManager.write(buffer, length);
};

/**
 * @method abort
 *
 */
SecureMessageChunkManager.prototype.abort = function () {
    this.aborted = true;
    this.end();
};

/**
 * @method end
 */
SecureMessageChunkManager.prototype.end = function () {
    this.chunkManager.end();
    this.emit("finished");
};


exports.SecureMessageChunkManager = SecureMessageChunkManager;


/**
 * @class MessageChunker
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @constructor
 */
function MessageChunker(options) {

    options = options || {};
    options.securityHeader = options.securityHeader ||
        new AsymmetricAlgorithmSecurityHeader( {securityPolicyUri:"http://opcfoundation.org/UA/SecurityPolicy#None"});

    assert(_.isObject(options));
    assert(_.isObject(options.securityHeader));
    // assert(_.has(options,"derivedKeys"));

    this.securityHeader = options.securityHeader ;
    this.derivedKeys = options.derivedKeys || null;
    this.sequenceNumberGenerator = new SequenceNumberGenerator();
}

/**
 * @method chunkSecureMessage
 * @param msgType {String}
 * @param options
 * @param options.tokenId
 * @param options.chunkSize    [default=8192]
 *
 * @param options.signatureLength  {Integer} [default=0]
 * @param options.signingFunc {Function} [default=null]
 *
 * @param message {Object}
 * @param messageChunkCallback   {Function}
 */
MessageChunker.prototype.chunkSecureMessage = function(msgType,options,message,messageChunkCallback) {

    assert(_.isFunction(messageChunkCallback));
    // calculate message size ( with its  encodingDefaultBinary)
    var binSize = message.binaryStoreSize() + 4;

    var stream = new BinaryStream(binSize);
    this._stream = stream;

    ec.encodeExpandedNodeId(message.encodingDefaultBinary,stream);
    message.encode(stream);

    var securityHeader;
    if (msgType === "OPN") {
        securityHeader = this.securityHeader;
    } else {
        securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId });
    }

    var secure_chunker = new SecureMessageChunkManager(
        msgType, options, securityHeader,this.sequenceNumberGenerator
    )
    .on("chunk",function(messageChunk){
        messageChunkCallback(messageChunk);
    })
    .on("finished",function(){
        messageChunkCallback(null);
    });

    secure_chunker.write(stream._buffer,stream._buffer.length);
    secure_chunker.end();
};

exports.MessageChunker = MessageChunker;
