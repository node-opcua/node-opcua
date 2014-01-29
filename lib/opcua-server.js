
var net = require('net');
var colors = require('colors');
var util = require('util');
var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require("assert");
var secureChannel = require("./secure_channel_service");


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

            var _stream = new Buffer(8192);

            socket.on('data',function(data)  {

                if (self.messageBuilder)  {
                    self.messageBuilder.feed(data);
                } else {

                    _stream = new opcua.BinaryStream(data);

                    msgType = data.slice(0,3).toString("ascii");
                    debugLog("SERVER received " + msgType.yellow);

                    if (msgType=="HEL") {

                        var helloMessage = opcua.decodeMessage(_stream,opcua.HelloMessage);
                        //xx debugLog(util.inspect(helloMessage,{ colors: true}));

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

                            opcua.sendMessage(socket,"ACK",acknowledgeMessage,function callback() {
                                //xx debugLog("send reply");
                            });
                        }
                    } else if (msgType=="OPN") {

                        self.messageBuilder  = new secureChannel.MessageBuilder();
                        self.messageBuilder.on("message",function(message) {

                            assert(message._description.name == "OpenSecureChannelRequest");

                            var openSecureChannelResponse  = new s.OpenSecureChannelResponse();
                            opcua.sendMessage(socket,"OPN",openSecureChannelResponse,function callback() {
                                    console.log(" received ", message);
                            });

                            self.messageBuilder.feed(data);

                        });
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
                opcua.sendMessage(socket,"ERR",errorResponse,function callback() {

                    // self.end();
                    // abruptly close this socket
                    self.destroy( );

                });
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

