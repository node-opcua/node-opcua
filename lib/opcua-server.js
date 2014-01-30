
var net = require('net');
var colors = require('colors');
var util = require('util');
var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require("assert");
var verify_message_chunk = require("./chunk_manager").verify_message_chunk;
var secure_channel = require("./secure_channel_service");
var hexy = require("hexy");


var doDebug  = require("../lib/utils").should_debug(__filename);
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}


function OPCUAServer()
{
    var self = this;

    self.protocolVersion = 1;
    self._helloreceived = false;


    self.messageBuilder = false;

    this._server = net.createServer(


        function(socket) {

            socket.name = "SERVER";

            debugLog('server is accepting client connection');

            socket.on('data',function(data)  {

                if (self.messageBuilder)  {

                    self.messageBuilder.feed(data);

                } else {

                    var stream = new opcua.BinaryStream(data);

                    msgType = data.slice(0,3).toString("ascii");
                    debugLog("SERVER received " + msgType.yellow);

                    if (msgType=="HEL") {

                        var helloMessage = opcua.decodeMessage(stream,opcua.HelloMessage);

                        if (helloMessage.protocolVersion <= 0 || helloMessage.protocolVersion > self.protocolVersion ) {

                            debugLog(" Server aborting because Bad_ProtocolVersionUnsupported".red);
                            // invalid protocol version requested by client
                            socket.abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported);

                        } else {

                            // the helloMessage shall only be received once.
                            self._helloreceived = true;

                            var acknowledgeMessage = new opcua.AcknowledgeMessage({
                                protocolVersion:   1,
                                receiveBufferSize: 8192,
                                sendBufferSize:    8192,
                                maxMessageSize:    100000,
                                maxChunkCount:     600000
                            });

                            var messageChunk= opcua.packTcpMessage("ACK",acknowledgeMessage);
                            socket.write(messageChunk);

                        }
                    } else if (msgType=="OPN") {

                        self.messageBuilder  = new secure_channel.MessageBuilder();
                        self.messageBuilder.on("message",function(message) {


                            assert(message._description.name == "OpenSecureChannelRequest");
                            var openSecureChannelResponse  = new s.OpenSecureChannelResponse();

                            var chunk_number = 0;
                            options = {
                                requestId: 1, // Todo: fix me
                                secureChannelId: 0 // todo: fix me this.secureChannelId
                            };

                            secure_channel.chunkSecureMessage(msgType,options,openSecureChannelResponse,function(messageChunk){

                                if (messageChunk) {

                                    verify_message_chunk(messageChunk);
                                    debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow + "\n" + hexy.hexy(messageChunk,{ width: 32}).red );
                                    chunk_number += 1;
                                    socket.write(messageChunk);

                                } else {
                                    // note : self._responseReceiver with call callback() for us
                                    debugLog("SERVER SEND done.");
                                    self.messageBuilder = undefined;
                                }
                            });

                        });
                        self.messageBuilder.feed(data);
                    }
                }
            });

            socket.on('close', function() {
                debugLog('server disconnected (CLOSE)');
            });

            socket.on('end', function() {
                debugLog('server disconnected (END)');
            });

            self.connected_client_count+=1;

            socket.abortWithError = function(statusCode) {

                assert(statusCode);
                var self = this;
                // send the error message and close the connection
                assert(StatusCodes.hasOwnProperty(statusCode.name));

                var errorResponse  = new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
                var messageChunk = opcua.packTcpMessage("ERR",errorResponse);
                socket.write(messageChunk);

                // abruptly close this socket
                setImmediate(function() { self.destroy( );});
            };

        }


    );
    this._server.on("connection",function(socket){
        debugLog('CONNECTED: ' + socket.remoteAddress +':'+ socket.remotePort);
    });

    this.connected_client_count = 0;
}


OPCUAServer.prototype.listen = function(port)
{
    port = parseInt(port);
    this._started = true;
    this._server.listen(port, function() { //'listening' listener
        debugLog('server bound');
    });

};

OPCUAServer.prototype.shutdown = function(callback)
{
    if (this._started) {
        this._started = false;
        this._server.close(function(){
            callback();
        });
    } else {
        callback();
    }
};

exports.OPCUAServer = OPCUAServer;

