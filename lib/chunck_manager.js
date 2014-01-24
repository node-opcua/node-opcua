var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("assert");

function ChunkManager(chunk_size) {
    chunk_size = chunk_size || 1024;
    this.chunk_size=chunk_size;
    this.chunk = new Buffer(this.chunk_size);
    this.cursor = 0;
}
// extend the EventEmitter class using our Radio class
util.inherits(ChunkManager, EventEmitter);

ChunkManager.prototype.write = function(buffer,length) {

    assert(buffer instanceof Buffer || (buffer === null) );
    assert(length!=0);

    var l = length;
    var input_cursor =0;

    while (l>0) {
        assert(length-input_cursor!==0);

        if (this.cursor==0) {
            // let the client to write some stuff at the start of the chunk
            if (!this._in_before_chunk) {
                this._in_before_chunk = true;
                this.emit("before_chunk",this.chunk);
                this._in_before_chunk = false;
            }
        }
        // space left in current chunk
        var space_left = this.chunk_size - this.cursor;

        var nb_to_write =Math.min(length-input_cursor,space_left);

        if (buffer) {
            buffer.copy(this.chunk,this.cursor,input_cursor,input_cursor+nb_to_write);
        } else {
            // just reserving space
        }

        input_cursor+=nb_to_write;
        this.cursor +=nb_to_write;
        if (this.cursor>=this.chunk_size) {
            this.emit("chunk",this.chunk);
            this.cursor = 0;
        }
        l-=nb_to_write;
    }
};
ChunkManager.prototype.eof = function() {
    if (this.cursor>0) {
        this.emit("chunk",this.chunk.slice(0,this.cursor));
        this.cursor =0;
    }
}


exports.ChunkManager = ChunkManager;


/**
 * MessageChunkManager split message in chunks and add a header in front
 * of each chunk.
 *
 * the header is described in OPC Unified Architecture, Part 6 page 36.
 *
 * @param messageSize
 * @param msgType
 * @param secureChannelId
 * @constructor
 */
function MessageChunkManager(messageSize,msgType,secureChannelId)
{
    msgType = msgType || "HEL";
    secureChannelId = secureChannelId || 0;
    assert(msgType.length===3);
    assert(messageSize>12);

    this.messageSize  = messageSize;
    this.msgType      = msgType;
    this.secureChannelId = secureChannelId;
    this.sizeOfHeader = 12;
    this.bodySize     = messageSize-this.sizeOfHeader;
    this.chunkManager = new ChunkManager(this.messageSize);

    var self = this;

    this.chunkManager.on("chunk",function(chunk) {

       self._sendPendingChunk("C");
       var buf = new Buffer(chunk.length);
       chunk.copy(buf,0,0,chunk.length);
       self.pendingChunk = buf;

    }).on("before_chunk",function() {
       // reserve space for header
       self.chunkManager.write(null,self.sizeOfHeader);
    });
}
// extend the EventEmitter class using our Radio class
util.inherits(MessageChunkManager, EventEmitter);

MessageChunkManager.prototype.write = function(buffer,length) {

   this.chunkManager.write(buffer,length);

};
MessageChunkManager.prototype._sendPendingChunk = function(finalC) {

    assert(finalC.length === 1);

    if (this.pendingChunk) {
        var buf = this.pendingChunk;
        assert(buf instanceof Buffer);
        buf.writeUInt8(this.msgType.charCodeAt(0),0);
        buf.writeUInt8(this.msgType.charCodeAt(1),1);
        buf.writeUInt8(this.msgType.charCodeAt(2),2);
        buf.writeUInt8(finalC.charCodeAt(0),3);
        buf.writeUInt32LE(this.messageSize,4);
        buf.writeUInt32LE(this.secureChannelId,8);
        this.emit("chunk",buf);
        this.pendingChunk = 0;
    }

};

MessageChunkManager.prototype.abort = function() {
    this.chunkManager.eof();
    this._sendPendingChunk("A");
};

MessageChunkManager.prototype.eof = function() {
   // send pending chunk ...
   this.chunkManager.eof();
   this._sendPendingChunk("F");
};

exports.MessageChunkManager = MessageChunkManager;
