var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert=require('better-assert');
var _ = require("underscore");

var PacketAssembler = function(options)
{

    this._stack = [];
    this.expectedLength = 0;
    this.currentLength = 0;

    this.readMessageFunc= options.readMessageFunc;
    assert(_.isFunction(this.readMessageFunc),"packet assembler requires a readMessageFunc");

};
util.inherits(PacketAssembler, EventEmitter);

PacketAssembler.prototype._read_packet_info = function(data)
{
    return this.readMessageFunc(data);
};


PacketAssembler.prototype.feed = function(data) {

    assert(data.length > 0 , "PacketAssembler expects a no-zero size data block");
    assert(this.currentLength <= this.expectedLength);

    if (this._stack.length === 0 ) {
        // this is the fist packet
        // we can extract the expected length here
        this.packet_info = this._read_packet_info(data);

        this.expectedLength = this.packet_info.length;

        assert(this.currentLength === 0);
        // we can also validate the messageType ...
        this.emit("newMessage",this.packet_info,data);
    }

    if (this.currentLength + data.length < this.expectedLength )  {

        this._stack.push(data);
        this.currentLength += data.length;
        // expecting more data to complete current message chunk

    } else if (this.currentLength + data.length  === this.expectedLength ) {

        this._stack.push(data);
        this.currentLength += data.length;


        var messageChunk = Buffer.concat(this._stack, this.expectedLength);

        var packet_info = this._read_packet_info(messageChunk);

        assert( this.packet_info.length === packet_info.length);
        assert( messageChunk.length === packet_info.length);

        // reset
        this.currentLength = 0;
        this.expectedLength = 0;
        this._stack  =[];

        this.emit("message",messageChunk);

    } else {
        // there is more data in this chunk than expected...
        // the chunk need to be split
        var size1 = this.expectedLength - this.currentLength;
        //xx console.log(" size1",size1,  this.expectedLength , this.currentLength + data.length,data.length ,this.currentLength );
        if(size1 >0) {
            var chunk1 = data.slice(0,size1);
            this.feed(chunk1);
        }
        var chunk2 = data.slice(size1);
        if (chunk2.length>0) {
            this.feed(chunk2);
        }
    }
};
exports.PacketAssembler = PacketAssembler;

