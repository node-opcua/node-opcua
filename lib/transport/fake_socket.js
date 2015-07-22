"use strict";
/**
 * @module opcua.transport
 */
require("requirish")._(module);
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("better-assert");

function HalfComChannel() {
    this._has_ended = false;
}
util.inherits(HalfComChannel, EventEmitter);

HalfComChannel.prototype.write = function (data) {

    if (typeof data === "string") {
        data = new Buffer(data);
    }
    assert(data instanceof  Buffer, "HalfComChannel.write expecting a buffer");
    var self = this;
    var copy = Buffer.concat([data]);
    self.emit("send_data", copy);
};
HalfComChannel.prototype.end = function () {
    var self = this;
    if (!self._has_ended) {
        assert(!self._has_ended, "half communication channel has already ended !");
        self._has_ended = true;
        self.emit("ending");
        self.emit("end");
    }

};
HalfComChannel.prototype.destroy = function () {
};


function DirectTransport(done) {

    this.client = new HalfComChannel();
    this.server = new HalfComChannel();

    var self = this;
    this.client.on("send_data", function (data) {
        assert(data instanceof  Buffer);
        self.server.emit("data", data);
    });
    this.server.on("send_data", function (data) {
        assert(data instanceof  Buffer);
        self.client.emit("data", data);
    });
    this.server.on("ending", function () {
        self.client.emit("end");
        self.client._has_ended = true;
    });
    this.client.on("ending", function () {
        self.server.emit("end");
        self.server._has_ended = true;
    });
    if (done) {
        setImmediate(done);
    }
}

DirectTransport.prototype.shutdown = function (done) {
    var self = this;
    self.client.end();
    self.server.end();
    if (done) {
        setImmediate(done);
    }
};

exports.DirectTransport = DirectTransport;


function SocketTransport(done) {

    var net = require("net");
    var self = this;

    var port = 5678;

    self.tcp_server = new net.Server();

    self.tcp_server.listen(port);
    self.tcp_server.on("connection", function on_connection(socket) {
        self.server = socket;
        done();

    });

    self.client = new net.Socket();
    self.client.connect(port, function () {
    });

}
SocketTransport.prototype.shutdown = function (done) {
    var self = this;

    self.client.end();
    self.server.end();
    self.tcp_server.close(done);
};
exports.SocketTransport = SocketTransport;
