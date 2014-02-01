var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("assert");
var opcua = require("./nodeopcua");

function verify_message_chunk(message_chunk)
{
   assert(message_chunk);
   var readMessageHeader= opcua.readMessageHeader;
   var header = readMessageHeader(new opcua.BinaryStream(message_chunk));
   if (message_chunk.length !== header.length) {
       throw new Error(" chunk length = " + message_chunk.length + " message  length " + header.length);
   }
   //xx console.log(header);
}



exports.verify_message_chunk = verify_message_chunk;

// see https://github.com/substack/_buffer-handbook
//     http://blog.nodejs.org/2012/12/20/streams2/
//     http://codewinds.com/blog/2013-08-20-nodejs-transform-streams.html
//
function ChunkManager(chunk_size) {
    chunk_size = chunk_size || 1024;
    this.chunk_size = chunk_size;
    this.chunk = new Buffer(this.chunk_size);
    this.cursor = 0;

}
util.inherits(ChunkManager, EventEmitter);

ChunkManager.prototype.write = function (buffer, length) {

    assert(buffer instanceof Buffer || (buffer === null));
    assert(length != 0);

    var l = length;
    var input_cursor = 0;

    while (l > 0) {
        assert(length - input_cursor !== 0);

        if (this.cursor == 0) {
            // let the client to write some stuff at the start of the chunk
            if (!this._in_before_chunk) {
                this._in_before_chunk = true;
                this.emit("before_chunk", this.chunk);
                this._in_before_chunk = false;
            }
        }
        // space left in current chunk
        var space_left = this.chunk_size - this.cursor;

        var nb_to_write = Math.min(length - input_cursor, space_left);

        if (buffer) {
            buffer.copy(this.chunk, this.cursor, input_cursor, input_cursor + nb_to_write);
            //xx console.log(buffer_ellipsis(this.chunk).green)
        } else {
            // just reserving space
        }

        input_cursor += nb_to_write;
        this.cursor += nb_to_write;
        if (this.cursor >= this.chunk_size) {
            assert(this.cursor === this.chunk_size);
            this.emit("chunk", this.chunk);
            this.cursor = 0;
        }
        l -= nb_to_write;
    }
};

var fill_padding = false;

ChunkManager.prototype.end = function () {
    if (this.cursor > 0) {


        if (fill_padding) {
            n = this.chunk_size - this.cursor;
            for (; this.cursor < this.chunk_size; this.cursor++) {
                this.chunk.writeUInt8(n % 256, this.cursor);
            }
        }

        this.emit("chunk", this.chunk.slice(0, this.cursor));
        this.cursor = 0;
    }
}


exports.ChunkManager = ChunkManager;


var through = require("through2");

var ChunkStream = function (chunkManager) {

    var cm = chunkManager;
    var tr = through(function (chunk, enc, next) {
        cm.write(chunk, chunk.length);
        next();
    }, function () {
        cm.end();
    });
    cm.on("chunk", function (chunk) {
        tr.push(chunk);
    });
    return tr;
};
exports.ChunkStream = ChunkStream;

function mark_buffer(buffer){
    for (var i=0;i<buffer.length;i++) {
        buffer.writeUInt8(0xEF,i);
    }
}
/**
 * MessageChunkManager split message in chunks and add a header in front
 * of each chunk.
 *
 * the header is described in OPC Unified Architecture, Part 6 page 36.
 *
 * @param messageSize     {int}
 * @param msgType         {string}
 * @param secureChannelId {int}
 * @param extraHeaderSize {int}
 * @constructor
 */
function MessageChunkManager(messageSize, msgType, secureChannelId,extraHeaderSize) {


    extraHeaderSize = extraHeaderSize || 0;
    msgType = msgType || "HEL";
    secureChannelId = secureChannelId || 0;
    assert(msgType.length === 3);
    assert(messageSize > 12);

    this.messageSize = messageSize;
    this.msgType = msgType;
    this.secureChannelId = secureChannelId;

    this.sizeOfHeader = 12 + extraHeaderSize;
    this.bodySize = messageSize - this.sizeOfHeader;

    this.chunkManager = new ChunkManager(this.bodySize);

    var self = this;

    this.chunkManager.on("chunk",function (chunk) {

        var offsetBody = self.sizeOfHeader;

        assert(self.messageSize >= chunk.length + offsetBody);

        self._sendPendingChunk("C");
        assert( !self.pendingChunk );

        self.pendingChunk = new Buffer(chunk.length + self.sizeOfHeader);
        mark_buffer(self.pendingChunk);

        chunk.copy(self.pendingChunk, offsetBody, 0, chunk.length);

    }).on("before_chunk", function () {

    });
}
util.inherits(MessageChunkManager, EventEmitter);


MessageChunkManager.prototype.write_header_and_footer = function (finalC, buf,length) {

    assert(finalC.length === 1);
    // reserve space for header
    var self = this;
    assert(buf instanceof Buffer);
    buf.writeUInt8(this.msgType.charCodeAt(0), 0);
    buf.writeUInt8(this.msgType.charCodeAt(1), 1);
    buf.writeUInt8(this.msgType.charCodeAt(2), 2);
    buf.writeUInt8(finalC.charCodeAt(0), 3);
    //xx buf.writeUInt32LE(this.messageSize, 4);
    buf.writeUInt32LE(length, 4);
    buf.writeUInt32LE(this.secureChannelId, 8);
};


MessageChunkManager.prototype.write = function (buffer, length) {

    this.chunkManager.write(buffer, length);

};
MessageChunkManager.prototype._sendPendingChunk = function (finalC) {

    assert(finalC.length === 1);

    if (this.pendingChunk) {

        this.write_header_and_footer(finalC, this.pendingChunk.slice(0,this.sizeOfHeader),this.pendingChunk.length);
        this.emit("chunk", this.pendingChunk);
        this.pendingChunk = 0;
    }

};

MessageChunkManager.prototype.abort = function () {

    this.chunkManager.end();
    this._sendPendingChunk("A");
};

MessageChunkManager.prototype.end = function () {

    // send pending chunk ...
    this.chunkManager.end();
    this._sendPendingChunk("F");
};

exports.MessageChunkManager = MessageChunkManager;






var PacketAssembler = function()
{
    this._stack = [];
    this.expectedLength = 0;
    this.currentLength = 0;
};
util.inherits(PacketAssembler, EventEmitter);

PacketAssembler.prototype.feed = function(data) {

    var messageHeader;
    assert (data.length >0);

    if (this._stack.length == 0 ) {
        // this is the fist packet
        // we can extract the expected length here
        messageHeader = opcua.readMessageHeader(new opcua.BinaryStream(data));
        this.expectedLength = messageHeader.length;
        assert(this.currentLength == 0);
    }
    this._stack.push(data);
    this.currentLength += data.length;

    if (this.currentLength < this.expectedLength )  {
        return; // expecting more data to complete current message chunk
    } else if (this.currentLength == this.expectedLength ) {

        var messageChunk = Buffer.concat(this._stack, this.expectedLength);

        messageHeader = opcua.readMessageHeader(new opcua.BinaryStream(messageChunk));

        assert( this.expectedLength === messageHeader.length);
        assert( messageChunk.length === messageHeader.length);

        this.emit("message",messageChunk);

        // reset
        this.currentLength = 0;
        this.expectedLength = 0;
        this._stack  =[];
    } else {
        throw new Error("invalid length ! currentLength = " + this.currentLength + " expectedLength="+ this.expectedLength);
    }
};

exports.PacketAssembler = PacketAssembler;


var MessageBuilderBase = function () {

    this.total_size = 0;
    this.blocks = [];
    this.packetAssembler = new PacketAssembler();

    var self = this;
    this.packetAssembler.on("message",function(messageChunk){
        self._feed_messageChunk(messageChunk);
    })

};

util.inherits(MessageBuilderBase, EventEmitter);


MessageBuilderBase.prototype._read_headers = function (binaryStream) {

    this.messageHeader = opcua.readMessageHeader(binaryStream);
    assert(binaryStream.length ===  8);
    this.secureChannelId = binaryStream.readUInt32();
    assert(binaryStream.length === 12);


};


MessageBuilderBase.prototype._append = function (messageChunk) {

    var binaryStream = new opcua.BinaryStream(messageChunk);

    this._read_headers(binaryStream);

    assert(binaryStream.length >= 12);

    if (this.messageHeader.length != messageChunk.length) {
        throw new Error("Invalid messageChunk size: the provided chunk is " + messageChunk.length + " bytes long but header specifies " + this.messageHeader.length);
    }

    var offsetBodyStart = binaryStream.length;
    var offsetBodyEnd = this.messageHeader.length;

    this.total_size += (offsetBodyEnd - offsetBodyStart);
    this.offsetBodyStart = offsetBodyStart;

    // add message body to a queue
    // note : Buffer.slice create a shared memory !
    //        use Buffer.clone
    var shared_buf = messageChunk.slice(offsetBodyStart);
    var cloned_buf = new Buffer(shared_buf.length);
    shared_buf.copy(cloned_buf, 0, 0);

    this.blocks.push(cloned_buf);


};




MessageBuilderBase.prototype.feed = function (data) {

    this.packetAssembler.feed(data);
};


MessageBuilderBase.prototype._feed_messageChunk = function(messageChunk) {

    assert(messageChunk);
    var messageHeader = opcua.readMessageHeader(new opcua.BinaryStream(messageChunk));

    //xx console.log("messageHeader",messageHeader);

    if (messageHeader.isFinal === "F") {

        // last message
        this._append(messageChunk);

        var buf = Buffer.concat(this.blocks);

        assert(buf.length == this.total_size);

        this.emit("raw_buffer", buf);

        if (this._on_raw_buffer) {
            this._on_raw_buffer(buf);
        }

    } else if (messageHeader.isFinal == "A") {
        // error
        this.emit("error");

    } else if (messageHeader.isFinal == "C") {
        this._append(messageChunk);

        // check that this packet is in the correct order

        // verify signature

        // decrypt packet

        // if first packet read object type

    }

};

exports.MessageBuilderBase = MessageBuilderBase;


