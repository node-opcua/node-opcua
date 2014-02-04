
var net = require('net');
var util = require('util');
var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require("assert");
var verify_message_chunk = require("./chunk_manager").verify_message_chunk;
var secure_channel = require("./secure_channel_service");
var hexy = require("hexy");
var crypto = require("crypto");
var async = require('async');
var packet_analyzer = require("../lib/packet_analyzer").packet_analyzer;
var messageHeaderToString = require("../lib/packet_analyzer").messageHeaderToString;

var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}
var last_channel_id = 0;
function getNextChannelId(){
    last_channel_id +=1;
    return last_channel_id;
}

function OPCUAChannel() {
    this.securityToken = new s.ChannelSecurityToken({
        secureChannelId: getNextChannelId(),
        tokenId:         1, // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: 30000
    });
    this.serverNonce = crypto.randomBytes(32);
}

function promoteAsOPCUATcpSocket(socket,endpoint) {

    assert(endpoint instanceof OPCUAServerEndPoint);

    socket.endpoint = endpoint;
    socket.name = "SERVER";

    socket._helloreceived = false;

    // setup message builder that will be active once HEL has been received
    socket.messageBuilder = new secure_channel.MessageBuilder();

    socket.messageBuilder.on("chunk", function (chunk) {
    });
    socket.messageBuilder.on("raw_buffer", function (buffer) {

        packet_analyzer(buffer);
    });
    socket.messageBuilder.on("message", function (message) {

        assert(socket._helloreceived);
        socket._on_message(message);

    });

    socket.on('data',function(data)  {
        if (socket._helloreceived) {
            assert(socket.messageBuilder);
            socket.messageBuilder.feed(data);
        } else {
            var stream = new opcua.BinaryStream(data);
            var msgType = data.slice(0, 3).toString("ascii");
            debugLog("SERVER received " + msgType.yellow);
            if (msgType === "HEL") {
                var helloMessage = opcua.decodeMessage(stream, opcua.HelloMessage);
                socket._on_hello_message(helloMessage);
            } else {
                // invalid packet , expecting HEL
                socket.abortWithError(Bad_CommunicationError," Expecting 'HEL' message to initiate communication");
            }
        }
    });

    socket.on('close', function() {
        debugLog('server disconnected (CLOSE)');
    });

    socket.on('end', function() {
        var server = this.endpoint.server;
        server.connected_client_count -=1;
        debugLog('server disconnected (END)');
    });

    socket.abortWithError = function(statusCode,extraErrorDescription) {

        assert(statusCode);
        assert(socket === this);
        // send the error message and close the connection
        assert(StatusCodes.hasOwnProperty(statusCode.name));

        debugLog((" Server aborting because "+ statusCode.name).red);
        debugLog((" extraErrorDescription "+  extraErrorDescription).red);
        var errorResponse  = new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
        var messageChunk = opcua.packTcpMessage("ERR",errorResponse);
        socket.write(messageChunk);

        // abruptly close this socket
        setImmediate(function() { socket.destroy();});
    };


    socket._on_hello_message = function(helloMessage) {

        var endpoint = this.endpoint;
        var server   = this.endpoint.server;

        assert( server.protocolVersion !== undefined);

        if (helloMessage.protocolVersion < 0 || helloMessage.protocolVersion > server.protocolVersion) {
            // invalid protocol version requested by client
            socket.abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported," Server version is " + server.protocolVersion);

        } else {

            // the helloMessage shall only be received once.
            socket._helloreceived = true;

            var acknowledgeMessage = new opcua.AcknowledgeMessage({
                protocolVersion:      server.protocolVersion,
                receiveBufferSize:    8192,
                sendBufferSize:       8192,
                maxMessageSize:     100000,
                maxChunkCount:      600000
            });
            var messageChunk = opcua.packTcpMessage("ACK", acknowledgeMessage);
            verify_message_chunk(messageChunk);
            debugLog("server send: " + "ACK".yellow);
            debugLog(hexy.hexy(messageChunk));
            socket.write(messageChunk);
            server.connected_client_count+=1;
        }
    };
    socket._on_message = function(message) {

        console.log("--------------------------------------------------------".green.bold,message._description.name);
        if (message instanceof s.OpenSecureChannelRequest ) {
            socket._on_OpenSecureChannelRequest(message);
        } else if (message instanceof s.GetEndpointsRequest) {
            socket._on_GetEndpointsRequest(message);
        } else {
            var errMessage = "UNSUPPORTED MESSAGE !! " + message._description.name;
            debugLog(errMessage.red.bold);
            socket.abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported,errMessage);
        }
    };

    socket._send_response = function(msgType,responseMessage) {

        var chunk_number = 0;
        var options = {
            requestId: 1,      // Todo: fix me
            secureChannelId: 0 // todo: fix me this.secureChannelId
        };

        secure_channel.chunkSecureMessage(msgType,options,responseMessage,function(messageChunk){

            if (messageChunk) {
                verify_message_chunk(messageChunk);
                debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow + "\n" +
                    hexy.hexy(messageChunk,{ width: 32, format: "twos" }).red );
                chunk_number += 1;
                socket.write(messageChunk);
            } else {
                // note : self._responseReceiver with call callback() for us
                debugLog("SERVER SEND done. (nbchunks = " + chunk_number + " )");
            }
        });
    };

    socket._on_OpenSecureChannelRequest = function(request) {

        var server = this.endpoint.server;
        var self = this;

        assert(request._description.name == "OpenSecureChannelRequest");

        if (request.requestType == s.SecurityTokenRequestType.RENEW ) {
            // creates a new SecurityToken for an existing SecureChannel .
        } else if(request.requestType == s.SecurityTokenRequestType.ISSUE) {
            // creates a new SecurityToken for a new SecureChannel
        } else {
            // Invalid requestType
        }
        var channel = this.endpoint.createChannel();

        var response  = new s.OpenSecureChannelResponse({
            serverProtocolVersion: server.protocolVersion,
            securityToken: channel.securityToken,
            serverNonce:   channel.serverNonce
        });

        self._send_response("OPN",response)
    };

    socket._on_GetEndpointsRequest = function(request) {
        var server = this.endpoint.server;
        var self = this;
        console.log("request._description.name" , request._description.name)
        assert(request._description.name == "GetEndpointsRequest");

        var response = new s.GetEndpointsResponse({

        });
        server.endpoints.forEach(function(endpoint){
            response.endpoints.push(endpoint.endpointDescription());
        });

        self._send_response("MSG",response);

    };

}

function OPCUAServerEndPoint(server,port) {

    assert(server instanceof OPCUAServer);

    var self = this;
    self.port = parseInt(port);

    self.server = server;
    self._channels = {};

    this._server = net.createServer(
        function(socket) {
            debugLog('server receiving a client connection');
            promoteAsOPCUATcpSocket(socket,self);
        }
    );
    this._server.on("connection",function(socket){
        debugLog('server connected  with : ' + socket.remoteAddress +':'+ socket.remotePort);
    });
}


OPCUAServerEndPoint.prototype.endpointDescription= function() {
    var self = this;

    var server = self.server;

    // return the endpoint object
    var endpoint = new s.EndpointDescription({
        endpointUrl: "opc.tcp://localhost:"+ this.port + "/UA/SampleServer",
        server: {
            applicationUri: "SampleServer",
            productUri: "SampleServer",
            applicationName: { text: "SampleServer" , locale: null },
            applicationType: s.EnumApplicationType.SERVER,
            gatewayServerUri: "",
            discoveryProfileUri: "",
            discoveryUrls: []
        },
        serverCertificate: server.getCertificate(),
        securityMode: s.MessageSecurityMode.NONE,
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
        userIdentityTokens: [
            {
                policyId: "0",
                tokenType: s.UserIdentityTokenType.ANONYMOUS,
                issuedTokenType: "",
                issuerEndpointUrl: "",
                securityPolicyUri: ""
            }
        ],
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
        securityLevel: 3
    });

    return endpoint;
};

/**
 * create a new secure channel object
 * @returns {OPCUAChannel}
 */
OPCUAServerEndPoint.prototype.createChannel = function() {

    var self = this;
    var channel = new OPCUAChannel();
    self._channels[channel.securityToken.secureChannelId] = channel;
    return channel;
};

OPCUAServerEndPoint.prototype.listen = function() {

    var self = this;
    self._started = true;
    self._server.listen(self.port, function() { //'listening' listener
        debugLog('server bound');
    });
};

OPCUAServerEndPoint.prototype.shutdown = function(callback) {
    var self = this;
    if (self._started) {
        self._started = false;
        self._server.close(function(){
            callback();
        });
    } else {
        callback();
    }
};

OPCUAServerEndPoint.prototype.start = function(callback) {
    this.listen();
};

OPCUAServer = function ()
{
    var self = this;

    this.endpoints = [];

    this.protocolVersion = 1;
    this.connected_client_count = 0;

    // add the tcp/ip endpoint with no security
    this.endpoints.push(new OPCUAServerEndPoint(this,65432));

};

/**
 * Initiate the server by starting all endpoints
 */
OPCUAServer.prototype.start = function(done) {

    done = done || function(){};

    var tasks =[];

    this.endpoints.forEach(function(endpoint){
        tasks.push( function(callback) { endpoint.start(callback);});
    });
    async.parallel(tasks,done);
};

OPCUAServer.prototype.shutdown = function(done) {

    assert(done);

    var tasks =[];
    this.endpoints.forEach(function(endpoint){
        tasks.push( function(callback) { endpoint.shutdown(callback);});
    });
    async.parallel(tasks,done);
};

OPCUAServer.prototype.getCertificate = function() {
    if (!this.certificate) {
        // create fake certificate
        var  read_certificate = require("../lib/crypto_utils").read_certificate;
        this.certificate = read_certificate("certificates/cert.pem");
    }
    return this.certificate;
}
exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;
