
var net = require("net");
var opcua = require("./nodeopcua");
var colors = require('colors');
var util = require('util');
var s = require("./structures");
var async = require("async");
var assert= require("assert");
var crypto = require("crypto");


var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}


function ResponseReceiver(responseClass,callback)
{
    this._responseClass = responseClass;
    this._callback = callback;

    var self = this;
    this._timeoutId = setTimeout(function(){
        self._callback(new Error("Timeout waiting for server replay: Server didn't respond"),null);
    },1000);
}

ResponseReceiver.prototype.handleResponse= function(msgType,stream) {

    clearTimeout(this._timeoutId);

    var responseClass = this._responseClass;
    var response = opcua.decodeMessage(stream,responseClass);
    debugLog("CLIENT RECEIVED "+ util.inspect(response).yellow);
    this._callback(null,response);

};

function OPCUAClient()
{
    var self = this;
    this.protocolVersion = 0;

}

OPCUAClient.prototype.connect = function(host, port , callback)
{

    var endpoint_url = "opc.tcp:" + host + ":" + port;

    var self = this;
    self._connection_callback = callback;
    // self._clientSocket.connect(port, host);

    this._clientSocket =  net.connect({ host: host,port: port});
    this._clientSocket.name = "CLIENT";

    self._responseReceiver = null;

    // Add a 'data' event handler for the client socket
    // data is what the server sent to this socket
    this._clientSocket.on('data', function(data) {

        debugLog("data from server received length = ",data.length);

        if (self._responseReceiver ) {

            var _stream = new opcua.BinaryStream(data);

            msgType = _stream._buffer.slice(0,3).toString("ascii");
            debugLog("CLIENT RECEIVED " + msgType.yellow + " " + _stream._buffer.toString("hex").red);

            receiver = self._responseReceiver;
            self._responseReceiver = null;
            receiver.handleResponse(msgType,_stream);

        }
        //xx debugLog(util.inspect(acknowledgeMessage,{ colors: true}));
    });

    // Add a 'close' event handler for the client socket
    this._clientSocket.on('close', function() {

        debugLog('Connection closed by server');

        if (self._connection_callback) {
            setImmediate(self._connection_callback,new Error("Connection ended !"));
            self._connection_callback = null;
        }
    });

    this._clientSocket.on('end', function(err) {
        debugLog('Connection ended');
    });

    this._clientSocket.on('error', function(err) {
       debugLog(" Error : "+ err);

        if (self._connection_callback) {
            setImmediate(self._connection_callback,err);
            self._connection_callback = null;
        }

    });

    this._clientSocket.on('connect', function() {


            async.series([

                function(callback) {
                    // Write a message to the socket as soon as the client is connected,
                    // the server will receive it as message from the client
                    msg = new opcua.HelloMessage({
                        protocolVersion:   self.protocolVersion,
                        receiveBufferSize: 8192,
                        sendBufferSize:    8192,
                        maxMessageSize:    0, // 0 - no limits
                        maxChunkCount:     0, // 0 - no limits
                        endpointUrl:       endpoint_url
                    });
                    self.sendOpcUARequest("HEL",msg,opcua.AcknowledgeMessage,function(err,response){

                        debugLog(" client received response ",util.inspect(response,{ color:true}));
                        callback();
                    });
                },
                function(callback) {


                    var zeroNonce = new Buffer(1);
                    zeroNonce.writeUInt8(0,0);

                    // OpenSecureChannel
                    msg = new s.OpenSecureChannelRequest({
                        clientProtocolVersion:    self.protocolVersion,
                        requestType:              s.SecurityTokenRequestType.ISSUE,
                        securityMode:             s.MessageSecurityMode.NONE,
                        clientNonce:              zeroNonce,
                        requestedLifetime:        300000
                    });
                    self.sendSecureOpcUARequest("OPN",msg, s.OpenSecureChannelResponse,function(err,response){
                        debugLog(" client received response ",util.inspect(response,{ color:true}));
                        callback();
                    });
                },
                function(callback) {
                    // get end point
                    // msg = new opcua.GetEndpointsRequest();
                    // self.sendOpcUARequest(msg,opcua.GetEndpointsResponse,callback);
                    callback();
                }
            ], function() {
                setImmediate(self._connection_callback,null); // OK
                self._connection_callback = null;
            });
    });
}




OPCUAClient.prototype.sendOpcUARequest = function(msgType,msg,responseClass,callback) {

    assert(msgType.length == 3);

    var self = this;
    assert(!self._responseReceiver," send message already pending"); // already waiting for an packet

    // prepare a _responseReceiver with the provide callback
    self._responseReceiver = new ResponseReceiver(responseClass,callback);

    opcua.sendMessage(this._clientSocket,msgType,msg,function() {

    });

};
OPCUAClient.prototype.makeRequestId = function(){
    if (!this._lastRequestId ) {
        this._lastRequestId = 0;
    }
    this._lastRequestId +=1;
    return this._lastRequestId;
};

var verify_message_chunk = require("./chunk_manager").verify_message_chunk;


var secure_channel = require("./secure_channel_service");

OPCUAClient.prototype.sendSecureOpcUARequest = function(msgType,msg,responseClass,callback) {
    assert(msgType.length == 3);

    var self = this;

    debugLog(" CLIENT sending : ",JSON.stringify(msg,null," "));

    self._responseReceiver = new ResponseReceiver(responseClass,callback);
    // request Id for sequenceHeader
    var requestId = this.makeRequestId();

    secure_channel.chunkSecureMessage(requestId,msg,function(messageChunk){


        if (messageChunk) {
            verify_message_chunk(messageChunk);
            debugLog(" writing chunk",messageChunk.toString("hex"));
            self._clientSocket.write(messageChunk,function(){
                debugLog(" written chunk");
            });
        } else {
            // note : self._responseReceiver with call callback() for us
        }
    });


    // return this.sendOpcUARequest(msgType,msg,responseClass,callback);
};

OPCUAClient.prototype.disconnect = function(callback)
{
    this._clientSocket.end();
    callback();
};


exports.OPCUAClient = OPCUAClient;

