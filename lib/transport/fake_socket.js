var util = require("util");
var EventEmitter = require("events").EventEmitter;


function HalfComChannel() {

}
util.inherits(HalfComChannel, EventEmitter);

HalfComChannel.prototype.write = function(data) {
    var self = this;
    var copy = Buffer.concat([data]);
    //xx process.nextTick(function(){
    self.emit("send_data", copy);
    //xx});
};
HalfComChannel.prototype.end = function() {
    var self = this;
    process.nextTick(function(){
        self.emit("ending");
    })
};

function DirectTransport () {

    this.client = new HalfComChannel();
    this.server = new HalfComChannel();

    var self = this;
    this.client.on("send_data",function(data){
        self.server.emit("data",data);
    });
    this.server.on("send_data",function(data){
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

