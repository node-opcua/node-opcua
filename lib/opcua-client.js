
var net = require("net");
var opcua = require("./nodeopcua");
var colors = require('colors');
var util = require('util');
var s = require("./structures");
var async = require("async");
var assert= require("assert");
var crypto = require("crypto");
var EventEmitter = require("events").EventEmitter;
var MessageBuilder = require("../lib/secure_channel_service").MessageBuilder;
var hexy = require("hexy");
var prettyjson = require('prettyjson');
var treeify = require('treeify');
var doDebug  = require("../lib/utils").should_debug(__filename);
var ec = require("../lib/encode_decode");
var verify_message_chunk = require("./chunk_manager").verify_message_chunk;
var secure_channel = require("./secure_channel_service");
var PacketAssembler =  require("./chunk_manager").PacketAssembler;
var messageHeaderToString = require("./packet_analyzer").messageHeaderToString;
var packet_analyzer = require("./packet_analyzer").packet_analyzer;
var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}


/**
 * internal class to handle response reception and decoding
 *
 * @param expectedMsgTypes
 * @param responseClass
 * @param callback
 * @private
 */
function _ResponseReceiver(expectedMsgTypes,responseClass,callback) {

    EventEmitter.call(this);

    if (!(expectedMsgTypes instanceof Array )) {
        expectedMsgTypes = [expectedMsgTypes];
    }

    this._expectedMsgTypes = expectedMsgTypes;

    // add errors
    this._expectedMsgTypes.push("ERR");

    this._responseClass = responseClass;
    this._callback = callback;
    this._messageBuilder = new MessageBuilder();

    var self = this;



    this._messageBuilder.on("message",function(response){
        self._terminate();
        self._callback(null,response);
    }).on("error",function(err){
        self._terminate();
        self._callback(err,null);
    });



    this._timeoutId = setTimeout(function(){
        self._callback(new Error("Timeout waiting for server replay: Server didn't respond"),null);
        self._terminate();
    },2000);

    this.packetAssembler = new PacketAssembler();
    this.packetAssembler.on("message",function(messageChunk) {
        self._handle_response(messageChunk);
    });
}


util.inherits(_ResponseReceiver, EventEmitter);


_ResponseReceiver.prototype._terminate = function()
{
    clearTimeout(this._timeoutId);
    this.emit("finish");
};

_ResponseReceiver.prototype.handleResponse= function(data) {

    var self = this;
    self.packetAssembler.feed(data);
};

_ResponseReceiver.prototype._handle_response= function(messageChunk) {

    var self = this;

    var _stream = new opcua.BinaryStream(messageChunk);

    var messageHeader = opcua.readMessageHeader(_stream);

    var msgType = messageHeader.msgType; // msgType_stream._buffer.slice(0,3).toString("ascii");
    debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader)+"").yellow +  "\n" + hexy.hexy(messageChunk,{ width: 32}).blue.bold);
    debugLog(messageHeaderToString(messageChunk));

    if (this._expectedMsgTypes.indexOf(msgType) == -1) {
        // invalid message type received
        var errMessage ="the incoming messageChunk with msgType " + msgType + " is invalid ! expecting "+ this._expectedMsgTypes;
        debugLog(("ERROR  ").red +errMessage);
        self._callback(new Error(errMessage),null);
    }

    switch(msgType) {
        case "ACK":
            var responseClass = this._responseClass;
            _stream.rewind();
            var response = opcua.decodeMessage(_stream,responseClass);
            self._terminate();
            self._callback(null,response);
            break;
        case "OPN":
        case "CLO":
        case "MSG":
            debugLog("Adding data block to message builder");
            this._messageBuilder.feed(messageChunk);
            break;
        case "ERR":
            debugLog("ERR packet received");
            //xx this._messageBuilder.feed(messageChunk);
            //xx    var stream = new opcua.BinaryStream(messageChunk);
            var errCode = _stream.readUInt32();
            var reason =  ec.decodeUAString(_stream);
            self._terminate();
            self._callback(new Error("CODE 0x" + errCode.toString(16) + " : " + reason),null);
            break;
        default:
            self._callback(new Error(" INTERNAL ERROR "+ msgType),null);
            break;
    }

};

/**
 *
 * @constructor OPCUAClient
 */
function OPCUAClient() {
    this.protocolVersion = 0;
}

/**
 * connect OPCUA client to server
 *
 * @param host
 * @param port
 * @param callback
 */
OPCUAClient.prototype.connect = function(host, port , callback)
{

    console.log(" hostname =" ,host);
    var endpoint_url = "opc.tcp://" + host + ":" + port;

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
            self._responseReceiver.handleResponse(data);
        } else {
            // ignored packet
        }

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

                //------------------------------------------------- STEP 1 : HEL->ACK
                function(callback) {


                    // Write a message to the socket as soon as the client is connected,
                    // the server will receive it as message from the client
                    var msg = new opcua.HelloMessage({
                        protocolVersion:   self.protocolVersion,
                        receiveBufferSize: 8192,
                        sendBufferSize:    8192,
                        maxMessageSize:    0, // 0 - no limits
                        maxChunkCount:     0, // 0 - no limits
                        endpointUrl:       endpoint_url
                    });
                    self.sendOpcUARequest("HEL",msg,opcua.AcknowledgeMessage,function(err,response){

                        debugLog(" client received response ",util.inspect(err,{ color:true}),util.inspect(response,{ color:true}));
                        if (!err) {

                        }
                        callback(err);
                    });
                },


                //------------------------------------------------- STEP 2 : OpenSecureChannel
                function(callback) {
                    // OpenSecureChannel
                    var msg = new s.OpenSecureChannelRequest({
                        clientProtocolVersion:    self.protocolVersion,
                        requestType:              s.SecurityTokenRequestType.ISSUE,
                        securityMode:             s.MessageSecurityMode.NONE,
                        requestHeader: {
                            auditEntryId:             null
                        },
                        clientNonce:              new Buffer(0), //
                        requestedLifetime:        30000
                    });
                    self.sendSecureOpcUARequest("OPN",msg, s.OpenSecureChannelResponse,function(err,response){
                        if (!err) {
                            debugLog(response);
                            //xx debugLog(" client received response ",prettyjson.render(err));
                            //xx debugLog( treeify.asTree(response,true));
                            self.secureChannelId = response.securityToken.secureChannelId;
                        }
                        callback();
                    });
                },


                //------------------------------------------------- STEP 3 : GetEndpointsRequest
                function(callback) {
                    // OpenSecureChannel
                    var msg = new s.GetEndpointsRequest(
                        {
                            endpointUrl: endpoint_url,
                            localeIds: [],
                            requestHeader: {
                                auditEntryId:             null
                            },

                        }
                    );
                    self._lastRequestId = 0;
                    self.sendSecureOpcUARequest("MSG",msg, s.GetEndpointsResponse,function(err,response){
                        if (!err) {
                            debugLog(response);
                            //xx debugLog(" client received response ",prettyjson.render(err));
                            //xx debugLog( treeify.asTree(response,true));
                        }
                        callback();
                    });
                    callback();
                }


            ], function(err) {

                if (err) {

                    self.disconnect(function() {

                        if (self._connection_callback) {
                            setImmediate(self._connection_callback,err); // OK
                            self._connection_callback = null;
                        }
                    });
                } else {
                    if (self._connection_callback) {
                        setImmediate(self._connection_callback,err); // OK
                        self._connection_callback = null;
                    }
                }
            });
    });
};


OPCUAClient.prototype._installReceiver = function(expectedType,responseClass,callback)
{
    var self = this;
    assert(!self._responseReceiver," send message already pending"); // already waiting for an packet
    // prepare a _responseReceiver with the provide callback
    self._responseReceiver = new _ResponseReceiver(expectedType,responseClass,callback);

    self._responseReceiver.on("finish",function() {
        self._responseReceiver = undefined;
    });
};


OPCUAClient.prototype.sendOpcUARequest = function(msgType,msg,responseClass,callback) {

    assert(msgType.length == 3);
    assert(msgType=="HEL");

    this._installReceiver(["ACK","ERR"],responseClass,callback);


    var messageChunk = opcua.packTcpMessage(msgType,msg)
    verify_message_chunk(messageChunk);

    debugLog("CLIENT SEND " + msgType.yellow + "\n" + hexy.hexy(messageChunk,{ width: 32}).red );

    this._clientSocket.write(messageChunk,function(){});

};

/**
 *
 * @returns {number} generate the next request id
 */
OPCUAClient.prototype.makeRequestId = function(){
    if (!this._lastRequestId ) {
        this._lastRequestId = 0;
    }
    this._lastRequestId +=1;
    return this._lastRequestId;
};


/**
 *
 * @param msgType
 * @param msg
 * @param responseClass
 * @param callback
 */
OPCUAClient.prototype.sendSecureOpcUARequest = function(msgType,msg,responseClass,callback) {

    assert(msgType.length == 3);
    assert(responseClass);

    this._installReceiver(msgType,responseClass,callback);


    var self = this;
    var chunk_number=0;

    var  options = {
        requestId: this.makeRequestId(),
        secureChannelId: this.secureChannelId
    };

    msg.requestHeader.requestHandle = options.requestId;

    console.log( " CHANNEL ID " , this.secureChannelId);

    secure_channel.chunkSecureMessage(msgType,options,msg,function(messageChunk){

        if (messageChunk) {

            verify_message_chunk(messageChunk);
            debugLog("CLIENT SEND chunk "+ chunk_number + "  " + msgType.yellow + "\n" + hexy.hexy(messageChunk,{ width: 32}).red );
            debugLog(messageHeaderToString(messageChunk));

            chunk_number += 1;
            self._clientSocket.write(messageChunk,function(){});

        } else {
            // note : self._responseReceiver with call callback() for us
            debugLog("CLIENT SEND done.");
        }
    });
    // return this.sendOpcUARequest(msgType,msg,responseClass,callback);
};

/**
 * disconnect client from server
 * @param callback
 */
OPCUAClient.prototype.disconnect = function(callback) {
    this._clientSocket.end();
    callback();
};

exports.OPCUAClient = OPCUAClient;

