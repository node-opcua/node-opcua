
var EventEmitter = require("events").EventEmitter;

var BinaryStream = require("../../lib/binaryStream").BinaryStream;
var verify_message_chunk = require("../../lib/chunk_manager").verify_message_chunk;
var writeTCPMessageHeader  = require("../../lib/nodeopcua").writeTCPMessageHeader;
var readRawMessageHeader = require("../../lib/message_builder_base").readRawMessageHeader;
var PacketAssembler     =  require("../../lib/transport/packet_assembler").PacketAssembler;
var hexDump = require("../../lib/utils").hexDump;
var util = require('util');
var s = require("../../lib/structures");
var assert= require('better-assert');
var utils = require("../../lib/utils");
var net = require("net");

var debugLog  = require("../../lib/utils").make_debugLog(__filename);
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var _ = require("underscore");

var fakeSocket = { invalid: true};

exports.setFakeTransport = function( socket_like_mock)  {
    fakeSocket = socket_like_mock;
};

function createClientSocket(endpoint_url) {
    // create a socket based on Url
    var ep = opcua.parseEndpointUrl(endpoint_url);
    var port = ep.port;
    var hostname = ep.hostname;
    switch(ep.protocol) {
        case "opc.tcp":
            return net.connect({ host: hostname,port: port});
        default:
            assert(ep.protocol=="fake"," Unsupported transport protocol");
            process.nextTick(function(){
                fakeSocket.emit("connect");
            });
            return fakeSocket;
    }
}


function TCP_transport() {
    this.timeout         = 2000; // 2 seconds timeout
    this.headerSize      =  8;
    this.protocolVersion =  1;
}
util.inherits(TCP_transport, EventEmitter);


/**
 * createChunk checkouts a buffer to be prepare
 * @param msg_type
 * @param chunk_type
 * @param length
 * @returns {Buffer}
 */
TCP_transport.prototype.createChunk = function(msg_type,chunk_type,length)
{
    assert(this._pending_buffer === undefined, "createChunk has already been called ( use write first)");

    var total_length = length + this.headerSize;
    var buffer       = new Buffer(total_length);
    writeTCPMessageHeader("MSG",chunk_type,total_length,buffer);

    this._pending_buffer = buffer;

    return buffer;
};

/**
 * write is like committing the message_chunk
 *
 * @param message_chunk
 */
TCP_transport.prototype.write = function(message_chunk)
{
    assert( (this._pending_buffer === undefined)|| this._pending_buffer === message_chunk, " write should be used with buffer created by createChunk");

    var header = readRawMessageHeader(message_chunk);
    assert(header.length === message_chunk.length);
    assert(['F','C','A'].indexOf(header.messageHeader.isFinal) != -1);

    if (this._socket) {
        this._socket.write(message_chunk);
    }

    this._pending_buffer = undefined;
};

TCP_transport.prototype._install_one_time_message_receiver = function(callback) {

    var self = this;

    var the_callback  =  callback;
    function __abort_pending_op(err) {
        if (self._timerId ) {
            clearTimeout(self._timerId);
            self._timerId = 0;
        }
        if (the_callback){
            the_callback(err);
        }
        the_callback = null;

    }

    self._timerId = setTimeout(function(){
        __abort_pending_op(new Error("Timeout in waiting for data on socket"));
    },self.timeout);

    self._socket.once("data",function(data){
        if(self._timerId){
            clearTimeout(self._timerId);
            if (the_callback){
                the_callback(null,data);
            }
            the_callback = null;
        } else {
            // callback already processed after timing out
        }
    }).once("end",function(){
        __abort_pending_op(new Error("Connection aborted by server"));
        self.disconnect(function(){});
    });
};


TCP_transport.prototype.disconnect = function(callback) {

    assert(_.isFunction(callback),"expecting a callback function, but got "+ callback);

    if(this._socket) {
        this._socket.end();
        // xx this._socket.destroy();
        this._socket = null;
        this.emit("close");
    }
    callback();
};


TCP_transport.prototype._install_packet_assembler = function() {
    var self = this;
    // ready to receive and send data
    self.packetAssembler = new PacketAssembler({
        readMessageFunc: readRawMessageHeader
    });
    self.packetAssembler.on("message",function(message_chunk){
        self.emit('message',message_chunk);
    });
    self.packetAssembler.on("newMessage",function(packet_info,partial_chunk){

    });
};

/**
 * a ClientTCP_transport connects to a remote server socket and
 * initiate a communication in HEL/ACK transaction that negociates
 * the communication parameters.
 *
 * @example
 *           var transport = ClientTCP_transport(url);
 *
 *           transport.timeout = 1000;
 *
 *           transport.connect(function(err)) {
 *                if (err) {
 *                   // cannot connect
 *                } else {
 *                   // connected
 *
 *                }
 *           });
 *           ....
 *
 *           transport.write(message_chunk,'F');
 *
 *           ....
 *
 *           transport.on("message",function(message_chunk) {
 *               // do something with message from server...
 *           });
 *
 *
 * @constructor ClientTCP_transport
 */
var ClientTCP_transport = function() {
    TCP_transport.call(this);
};
util.inherits(ClientTCP_transport,TCP_transport);


ClientTCP_transport.prototype.connect = function(endpoint_url,callback,options) {

    options = options || {};

    var self = this;

    self.protocolVersion = (options.protocolVersion !== undefined) ? options.protocolVersion : self.protocolVersion;

    var ep = opcua.parseEndpointUrl(endpoint_url);

    var hostname =require("os").hostname();

    self.endpoint_url = endpoint_url;

    self.serverUri = "urn:" + hostname + ":Sample";

    self._socket = createClientSocket(endpoint_url);
    self._socket.name = "CLIENT";

    self._connection_callback = callback;

    debugLog("endpoint_url =" , endpoint_url , "ep",ep);

    // Add a 'close' event handler for the client socket
    self._socket.on('close', function() {
        // debugLog('Connection closed by server');
        // self._abort_pending_op(new Error("Connection closed by server"));
    });

    self._socket.on('end', function(err) {
        // debugLog('Connection ended');
    });

    self._socket.on('error', function(err) {
        debugLog(" Error : "+ err);
        self._abort_pending_op(err);
    });

    self._socket.on('connect', function() {
        self._send_hello_ack();
    });

    self.packetAssembler = undefined;
    self._socket.on("data",function(data){
        if (self.packetAssembler && data.length>0) {
            self.packetAssembler.feed(data);
        }
    });
};

ClientTCP_transport.prototype._abort_pending_op = function(err) {
    var self = this;
    if (self._timerId ) {
        clearTimeout(self._timerId);
        self._timerId = 0;
    }
    if (self._connection_callback) {
        setImmediate(self._connection_callback,err);
        self._connection_callback = null;
    }
    //xx self._socket = null;
};

ClientTCP_transport.prototype._handle_ack_response = function(message_chunk,callback) {

    var _stream = new BinaryStream(message_chunk);
    var messageHeader = opcua.readMessageHeader(_stream);

    if (messageHeader.isFinal != 'F') {
        err = new Error(" invalid ACK message");
        callback(err);
        return;
    }

    var responseClass,response;
    if (messageHeader.msgType === "ERR") {
        responseClass = opcua.TCPErrorMessage;
        _stream.rewind();
        response = opcua.decodeMessage(_stream,responseClass);

        callback(new Error("Code 0x"+ response.name.toString(16) + " : "+response. reason))
    } else {
        responseClass = opcua.AcknowledgeMessage;
        _stream.rewind();
        response = opcua.decodeMessage(_stream,responseClass);
        this.parameters = response;
        callback(null);
    }

};

ClientTCP_transport.prototype._send_hello_ack = function() {

    var self = this;

    assert(self._socket);

    self._install_one_time_message_receiver(function(err,data){

        if (err) {

            var callback = self._connection_callback;
            self._connection_callback = 0;
            callback(err);

        } else {
            self._handle_ack_response(data,function(err) {
                if (!err) {
                    self._install_packet_assembler();


                }
                var callback = self._connection_callback;
                self._connection_callback = 0;
                callback(err);
            });
        }
    });


    // Write a message to the socket as soon as the client is connected,
    // the server will receive it as message from the client
    var request = new opcua.HelloMessage({
        protocolVersion:   self.protocolVersion,
        receiveBufferSize: 8192,
        sendBufferSize:    8192,
        maxMessageSize:    0, // 0 - no limits
        maxChunkCount:     0, // 0 - no limits
        endpointUrl:       self.endpoint_url
    });

    var messageChunk = opcua.packTcpMessage("HEL",request);

    this._socket.write(messageChunk,function(){});

};


exports.ClientTCP_transport = ClientTCP_transport;


var ServerTCP_transport = function() {
    TCP_transport.call(this);
    this._socket = null;

};
util.inherits(ServerTCP_transport,TCP_transport);

ServerTCP_transport.prototype.end = "DEPRECATED";

ServerTCP_transport.prototype._abortWithError = function(statusCode,extraErrorDescription) {

    assert(statusCode);

    var self = this;
    // send the error message and close the connection
    assert(StatusCodes.hasOwnProperty(statusCode.name));

    debugLog((" Server aborting because "+ statusCode.name).red);
    debugLog((" extraErrorDescription "+  extraErrorDescription).red);
    var errorResponse  = new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
    var messageChunk = opcua.packTcpMessage("ERR",errorResponse);

    self.write(messageChunk);

    self.disconnect(function(){});
};

ServerTCP_transport.prototype._on_hello_message = function(helloMessage,callback) {

    var self = this;

    assert( this.protocolVersion !== undefined);

    if (helloMessage.protocolVersion < 0 || helloMessage.protocolVersion > self.protocolVersion) {
        // invalid protocol version requested by client
        self._abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported," Server version is " + self.protocolVersion);
        callback(new Error("Protocol version mismatch"));
    } else {

        // the helloMessage shall only be received once.
        self._helloreceived = true;

        var acknowledgeMessage = new opcua.AcknowledgeMessage({
            protocolVersion:      self.protocolVersion,
            receiveBufferSize:    8192,
            sendBufferSize:       8192,
            maxMessageSize:     100000,
            maxChunkCount:      600000
        });
        var messageChunk = opcua.packTcpMessage("ACK", acknowledgeMessage);
        verify_message_chunk(messageChunk);
        debugLog("server send: " + "ACK".yellow);
        debugLog(hexDump(messageChunk));

        // install packet receiver
        self._install_packet_assembler();

        self.write(messageChunk);

        callback(null); // no Error

    }
};

ServerTCP_transport.prototype.init = function(socket,callback) {

    assert(!this.socket, "init already called!");
    assert(_.isFunction(callback), "expecting a valid callback ");

    var self = this;
    self._socket = socket;
    self.packetAssembler = undefined;
    self._socket.on("data",function(data){
        if (self.packetAssembler) {
            self.packetAssembler.feed(data);
        }
    });

    self._install_one_time_message_receiver(function(err,data){
        if (err) {
            // some error => close socket
            self._abortWithError(StatusCodes.Bad_ConnectionRejected,err.message);
            callback(err);
        } else {
            // handle the HEL message
            var stream = new BinaryStream(data);
            var msgType = data.slice(0, 3).toString("ascii");
            debugLog("SERVER received " + msgType.yellow);
            if (msgType === "HEL") {
                var helloMessage = opcua.decodeMessage(stream, opcua.HelloMessage);
                self._on_hello_message(helloMessage,callback);

            } else {
                // invalid packet , expecting HEL
                self._abortWithError(StatusCodes.Bad_CommunicationError," Expecting 'HEL' message to initiate communication");
                callback(err);
            }
        }
    })

};

exports.ServerTCP_transport = ServerTCP_transport;
