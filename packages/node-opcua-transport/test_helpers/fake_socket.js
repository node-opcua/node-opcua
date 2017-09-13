"use strict";
/**
 * @module opcua.transport
 */

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("node-opcua-assert");

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

HalfComChannel.prototype.setTimeout = function(){
};

function DirectTransport(done) {

    var self = this;

    self.client = new HalfComChannel();
    self.server = new HalfComChannel();

    self.client.on("send_data", function  client_send_data(data) {
        assert(data instanceof  Buffer);
        self.server.emit("data", data);
    });
    self.server.on("send_data", function server_send_data(data) {
        assert(data instanceof  Buffer);
        self.client.emit("data", data);
    });
    self.server.on("ending", function server_ending() {
        self.client.emit("end");
        self.client._has_ended = true;
    });
    self.client.on("ending", function client_ending() {
        self.server.emit("end");
        self.server._has_ended = true;
    });

    self.server.on("end",function(err){
        self.emit("end",err);
    });

    self.server.on("data",function server_socket_received_data_from_client_socket(data){
        var func = self.popResponse();
        if (func) {
            func(self.server,data);
        }
    });

    self.url = "fake://localhost:2033/SomeAddress";

    require("../src/tcp_transport").setFakeTransport(self.client);

    if (done) {
        setImmediate(done);
    }
}
util.inherits(DirectTransport, EventEmitter);


DirectTransport.prototype.shutdown = function (done) {
    var self = this;
    self.client.end();
    self.server.end();
    if (done) {
        setImmediate(done);
    }
};

DirectTransport.prototype.popResponse = function() {
    var self = this;
    if (!self._responses ) {
        return null;
    }
    var func = self._responses.shift();
    return func;
};

DirectTransport.prototype.pushResponse = function(func) {
    var self = this;
    self._responses = self._responses || [];
    self._responses.push(func);
};


exports.DirectTransport = DirectTransport;

var net = require("net");

function FakeServer(done) {
    var self = this;

    var port = 5678;
    self.port = port;

    self.url = "opc.tcp://localhost:" + port;

    self.tcp_server = new net.Server();

    //xx console.log(" listening on port ",port, " url ",self.url);

    self.tcp_server.listen(port,function(err) {
        if (err) {
            throw new Error(" cannot listing to port "+ port);
        }
        done();
    });
    self.__server_socket = null;
    self.tcp_server.on("connection", function on_connection(socket) {
        assert(!self.__server_socket," already connected");
        self.__server_socket = socket;

        self.__server_socket.on("data",function(data) {
            var func = self.popResponse();
            if(func) {
                func(self.__server_socket,data);
            }
        });
        self.__server_socket.on("err",function(err){
            //xx console.log(" @@@@ socket err ",err);
        });
        self.__server_socket.on("close",function(err){
            //xx console.log(" @@@@ socket closed ",err);
        });
        self.__server_socket.on("end",function(err){
            //xx console.log(" @@@@ socket end ",err);
            self.emit("end",err);
        });
    });
}
util.inherits(FakeServer, EventEmitter);

FakeServer.prototype.shutdown = function(callback) {
    var self = this;
        self.tcp_server.close(callback);
};

FakeServer.prototype.popResponse = function() {
    var self = this;
    if (!self._responses) {
        return null;
    }
    var func = self._responses.shift();
    return func;
};

FakeServer.prototype.pushResponse = function(func) {
    var self = this;
    self._responses = self._responses || [];
    self._responses.push(func);
};


exports.FakeServer = FakeServer;


function SocketTransport(done) {


    var self = this;
    FakeServer.call(this,function() {

        self.client = new net.Socket();
        self.client.connect(self.port, function (err) {
        });
        self.tcp_server.on("connection", function on_connection(socket) {
            self.server = self.__server_socket;
            done();
        });
    });
    
}
util.inherits(SocketTransport, FakeServer);

SocketTransport.prototype.shutdown = function (done) {
    var self = this;
    self.client.end();
    //xxself.server.end();
    FakeServer.prototype.shutdown.call(self,function(err) {
        done();
    });
};

exports.SocketTransport = SocketTransport;
