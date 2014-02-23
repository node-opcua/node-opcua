var net = require('net');
var util = require('util');
var assert = require('better-assert');
var async = require('async');
var _ = require("underscore");
var crypto = require("crypto");
var EventEmitter = require("events").EventEmitter;

var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;

var hexDump = require("../../lib/utils").hexDump;
var messageHeaderToString = require("../../lib/packet_analyzer").messageHeaderToString;

var debugLog = require("../../lib/utils").make_debugLog(__filename);

var ServerSecureChannelLayer = require("../../lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var ServerEngine = require("../../lib/server/server_engine").ServerEngine;
var browse_service = require("./../browse_service");
var read_service = require("./../read_service");

var NodeId = require("./../nodeid").NodeId;
var NodeIdType = require("./../nodeid").NodeIdType;


/**
 * OPCUAServerEndPoint a ServerEndPoint, listening to one port
 *
 * when a client is connecting, a  SecureChannelIsCreated
 *
 * @param server
 * @param port
 * @constructor
 */
function OPCUAServerEndPoint(server, port,options) {

    options = options || {};
    var self = this;
    self.port = parseInt(port);

    self.server = server;
    self._channels = [];

    self.defaultSecureTokenLiveTime = options.defaultSecureTokenLiveTime || 100;

    self._server = net.createServer(

        function (socket) {

            // a client is attempting a connection on the socket

            var channel = new ServerSecureChannelLayer({
                timeout: 1000,
                defaultSecureTokenLiveTime: self.defaultSecureTokenLiveTime || 30000
            });

            channel.init(socket, function (err) {
                if (err) {
                    socket.end();
                } else {
                    self._registerChannel(channel);
                    debugLog('server receiving a client connection');
                }
            });
            channel.on("message", function (message) {
                // forward
                self.emit("message",message,channel,self);
            });
            channel.on("abort",function(){
                // the channel has aborted
                self._unregisterChannel(channel);
            });
        }
    );
    self._server.on("connection", function (socket) {
        debugLog('server connected  with : ' + socket.remoteAddress + ':' + socket.remotePort);
    });
}
util.inherits(OPCUAServerEndPoint,EventEmitter);


OPCUAServerEndPoint.prototype.endpointDescription = function () {
    var self = this;

    var server = self.server;
    var hostname = require("os").hostname().toLowerCase();

    // return the endpoint object
    var endpoint = new s.EndpointDescription({
        endpointUrl: "opc.tcp://" + hostname + ":" + this.port + "/UA/SampleServer",
        server: {
            applicationUri: "SampleServer",
            productUri: "SampleServer",
            applicationName: { text: "SampleServer", locale: null },
            applicationType: s.ApplicationType.SERVER,
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
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            }
        ],
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
        securityLevel: 3
    });

    return endpoint;
};

/**
 *
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._registerChannel = function (channel) {
    var self = this;
    self._channels[channel.securityToken.secureChannelId] = channel;
};

OPCUAServerEndPoint.prototype._unregisterChannel = function (channel) {
    var self = this;
    delete self._channels[channel.securityToken.secureChannelId];
};

OPCUAServerEndPoint.prototype.listen = function () {

    var self = this;
    self._started = true;
    self._server.listen(self.port, function () { //'listening' listener
        debugLog('server bound');
    });
};

OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    var self = this;
    if (self._started) {
        self._started = false;
        self._server.close(function () {
            callback();
        });
    } else {
        callback();
    }
};

OPCUAServerEndPoint.prototype.start = function (callback) {
    this.listen();
    process.nextTick(callback);
};



exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
