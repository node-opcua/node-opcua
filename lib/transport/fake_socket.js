var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');

function HalfComChannel() {

}
util.inherits(HalfComChannel, EventEmitter);

HalfComChannel.prototype.write = function(data) {

    if (typeof data === "string") {
        data = new Buffer(data);
    }
    assert(data instanceof  Buffer , "HalfComChannel.write expecting a buffer");
    var self = this;
    var copy = Buffer.concat([data]);
    self.emit("send_data", copy);
};
HalfComChannel.prototype.end = function() {
    var self = this;
    self.emit("ending");

};

function DirectTransport () {

    this.client = new HalfComChannel();
    this.server = new HalfComChannel();

    var self = this;
    this.client.on("send_data",function(data){
        assert(data instanceof  Buffer);
        self.server.emit("data",data);
    });
    this.server.on("send_data",function(data){
        assert(data instanceof  Buffer);
        self.client.emit("data",data);
    });
    this.server.on("ending",function(){
        self.client.emit("end");
    });
    this.client.on("ending",function(){
        self.server.emit("end");
    });
}

exports.DirectTransport =DirectTransport;

