
var net = require("net");
var opcua = require("./nodeopcua");

var util = require('util');
var s = require("./structures");
var async = require("async");
var assert= require("assert");

var EventEmitter = require("events").EventEmitter;
var MessageBuilder = require("../lib/secure_channel_service").MessageBuilder;
var hexy = require("hexy");

var ec = require("../lib/encode_decode");
var verify_message_chunk = require("./chunk_manager").verify_message_chunk;
var secure_channel = require("./secure_channel_service");
var PacketAssembler =  require("./chunk_manager").PacketAssembler;
var messageHeaderToString = require("./packet_analyzer").messageHeaderToString;
var crypto = require("crypto");

var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}


/**
 * _ResponseReceiver is a internal class for TcpTransport client that handles
 *  response reception and decoding.
 * _ResponseReceiver provides a timeout to detect stall server.
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

    // 'ERR' is an expected msgType
    this._expectedMsgTypes.push("ERR");

    this._responseClass = responseClass;
    this._callback = callback;
    this._messageBuilder = new MessageBuilder();

    var self = this;

    this._messageBuilder.on("message",function(response){

        if (response instanceof s.ServiceFault) {
            var err = response;
            err.request = "TODO : inject request here for future diagnostic ";
            self._terminate(err,null);

        } else {
            self._terminate(null,response);
        }
    }).on("error",function(err){
        self._terminate(err,null);
    });


    this._timeoutId = setTimeout(function(){
        self._terminate(new Error("Timeout waiting for server replay: Server didn't respond"),null);
    },500);

}


util.inherits(_ResponseReceiver, EventEmitter);


_ResponseReceiver.prototype._terminate = function(err,response) {
    clearTimeout(this._timeoutId);
    this.emit("finish");
    this._callback(err,response);
};

_ResponseReceiver.prototype.onReceiveData= function(data) {

    var self = this;

    if (!self.packetAssembler) {
        self.packetAssembler = new PacketAssembler();
        self.packetAssembler.on("message",function(messageChunk) {
            self._handle_response(messageChunk);
        });
        self.packetAssembler.on("newMessage",function(msgType,data) {

            if (self._expectedMsgTypes.indexOf(msgType) == -1) {
                console.log(hexy.hexy(data,{ width: 32 , format: "twos"}));
                self._terminate(new Error("Invalid MESSAGE TYPE"),null);
            }
        });
    }
    self.packetAssembler.feed(data);
};

_ResponseReceiver.prototype._handle_response= function(messageChunk) {

    var self = this;

    var _stream = new opcua.BinaryStream(messageChunk);

    var messageHeader = opcua.readMessageHeader(_stream);

    var msgType = messageHeader.msgType; // msgType_stream._buffer.slice(0,3).toString("ascii");
    debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader)+"").yellow +  "\n" +
             hexy.hexy(messageChunk,{ width: 32, format:"twos"}).blue.bold);
    debugLog(messageHeaderToString(messageChunk));

    if (this._expectedMsgTypes.indexOf(msgType) == -1) {
        // invalid message type received
        var errMessage ="the incoming messageChunk with msgType " + msgType + " is invalid ! expecting "+ this._expectedMsgTypes;
        debugLog(("ERROR  ").red +errMessage);
        self._terminate(new Error(errMessage),null);
    }

    switch(msgType) {
        case "ACK":
            var responseClass = this._responseClass;
            _stream.rewind();
            var response = opcua.decodeMessage(_stream,responseClass);
            self._terminate(null,response);
            break;
        case "OPN":
        case "CLO":
        case "MSG":
            debugLog("Adding data block to message builder");
            this._messageBuilder.feed(messageChunk);
            break;
        case "ERR":
            debugLog("ERR packet received");

            var errCode = _stream.readUInt32();
            var reason =  ec.decodeUAString(_stream);
            self._terminate(new Error("CODE 0x" + errCode.toString(16) + " : " + reason),null);
            break;
        default:
            self._terminate(new Error(" INTERNAL ERROR "+ msgType),null);
            break;
    }
};


var  read_certificate = require("../lib/crypto_utils").read_certificate;
/**
 *
 * @constructor OPCUAClient
 */
function OPCUAClient() {
    this.protocolVersion = 1
    this._clientSocket = null;
    this._sessions = [];
    this._clientNonce = crypto.randomBytes(32);
    this._certificate = read_certificate("certificates/client_cert.pem");


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
    // prevent illegal
    if ( this._clientSocket) {
        process.nextTick(function() { callback(new Error("Already connected"),null);});
        return;
    }

    var self = this;
    //xx console.log(" hostname =" ,host);

    self.endpoint_url = "opc.tcp://" + host + ":" + port;

    self.serverUri = "";

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
            self._responseReceiver.onReceiveData(data);
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
        self._clientSocket = null;
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
                        endpointUrl:       self.endpoint_url
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
                        callback(err);
                    });
                },


                //------------------------------------------------- STEP 3 : GetEndpointsRequest
                function(callback) {
                    self.getEndPointRequest(function(err,endpoints){
                        callback(err);
                    });
                }


            ], function(err) {

                console.log(" here , err",err);
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


OPCUAClient.prototype.getEndPointRequest = function(callback) {

    var self = this;
    // OpenSecureChannel
    var request = new s.GetEndpointsRequest(
        {
            endpointUrl: self.endpoint_url,
            localeIds: [],
            requestHeader: {
                auditEntryId:   null
            }
        }
    );

    self.sendSecureOpcUARequest("MSG",request, s.GetEndpointsResponse,function(err,response){
        if (!err) {
            debugLog(response);
            callback(null,response.endpoints);
        } else {
            callback(err,null);
        }
    });
};

var OPCUASession = function(client) {
    this._client = client;
};

OPCUASession.prototype.browseName = function() {

};
OPCUASession.prototype.activate = function() {

};
OPCUASession.prototype.close = function() {
    this._client.closeSession(this);
};


OPCUAClient.prototype._nextSessionName = function()
{
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return 'Session' + this.___sessionName_counter;
};

OPCUAClient.prototype.createSession = function() {

}

OPCUAClient.prototype.createSession = function(callback) {

    assert(typeof(callback) === "function");


    var applicationDescription = s.ApplicationDescription({
        applicationUri: "application:uri",
        productUri: "uri:product",
        applicationName: { text: "MyApplication"},
        applicationType: s.EnumApplicationType.CLIENT,
        gatewayServerUri: undefined,
        discoveryProfileUri: undefined,
        discoveryUrls: []
        });


    var request = new s.CreateSessionRequest({
              clientDescription: applicationDescription,
                      serverUri: this.serverUri,
                    endpointUrl: this.endpointUrl,
                    sessionName: this._nextSessionName(),
                    clientNonce: this._clientNonce,
              clientCertificate: this._certificate,
        requestedSessionTimeout: 300000,
         maxResponseMessageSize: 800000
    });

    var self  = this;

    self.sendSecureOpcUARequest("MSG",request, s.CreateSessionResponse,function(err,response){


        if (!err) {

            assert( response instanceof s.CreateSessionResponse);

            var session = new OPCUASession(this);
            session.name = createSessionRequest.sessionName;

            session.sessionId           = response.sessionId;
            session.authenticationToken = response.authenticationToken;
            session.timeout             = response.revisedSessionTimeout;
            session.serverNonce         = response.serverNonce;
            session.serverCertificate   = response.serverCertificate;
            session.serverSignature     = response.serverSignature;

            self._sessions.push(session);

            callback(null,session);

        } else {

            callback(err,null);
        }
    });


};

OPCUAClient.prototype.closeSession = function(session) {

    var index = this._sessions.indexOf(session);
    if (index >=0 ) {
        this._sessions.splice(index, 1);
    }
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

    var messageChunk = opcua.packTcpMessage(msgType,msg);

    verify_message_chunk(messageChunk);

    debugLog("CLIENT SEND " + msgType.yellow + "\n" + hexy.hexy(messageChunk,{ width: 32, format: "twos"}).red );

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
            debugLog("CLIENT SEND chunk "+ chunk_number + "  " + msgType.yellow + "\n" +
                hexy.hexy(messageChunk,{ width: 32 , format: "twos"}).red );
            debugLog(messageHeaderToString(messageChunk));

            chunk_number += 1;
            if (self._clientSocket) {
                self._clientSocket.write(messageChunk,function(){});
            } else {
                console.log(" skipping messageChunk write because _clientSocket Socket has been deleted !")
            }

        } else {
            // note : self._responseReceiver with call callback() for us
            debugLog("CLIENT SEND done.");
        }
    });
};

/**
 * disconnect client from server
 * @param callback
 */
OPCUAClient.prototype.disconnect = function(callback) {
    if(this._clientSocket) {
        this._clientSocket.end();
    }
    this._clientSocket = null;
    callback();
};

exports.OPCUAClient = OPCUAClient;

