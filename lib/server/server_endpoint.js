var net = require('net');
var util = require('util');
var assert = require('better-assert');
var async = require('async');
var _ = require("underscore");
var crypto = require("crypto");
var EventEmitter = require("events").EventEmitter;

var s = require("../datamodel/structures");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

var hexDump = require("../misc/utils").hexDump;
var messageHeaderToString = require("../misc/packet_analyzer").messageHeaderToString;

var debugLog = require("../misc/utils").make_debugLog(__filename);

var ServerSecureChannelLayer = require("../../lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var ServerEngine = require("../../lib/server/server_engine").ServerEngine;
var browse_service = require("./../services/browse_service");
var read_service = require("./../services/read_service");

var NodeId = require("./../datamodel/nodeid").NodeId;
var NodeIdType = require("./../datamodel/nodeid").NodeIdType;


/**
 * OPCUAServerEndPoint a Server EndPoint.
 * @class OPCUAServerEndPoint
 *
 * A sever end point is listening to one port
 *
 * @param server
 * @param port
 * @param options
 * @constructor
 */
function OPCUAServerEndPoint(server, port,options) {

    options = options || {};
    var self = this;
    self.port = parseInt(port,10);

    self.server = server;

    self._channels = {};

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    self._server = net.createServer(

        function (socket) {

            // a client is attempting a connection on the socket

            var channel = new ServerSecureChannelLayer({
                timeout: 1000,
                defaultSecureTokenLifetime: self.defaultSecureTokenLifetime || 30000
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
            channel.on("abort",function(req){
                // the channel has aborted
                self._unregisterChannel(channel);
            });
        }
    );
    self._server.on("connection", function (socket) {
        debugLog('server connected  with : ' + socket.remoteAddress + ':' + socket.remotePort);

    }).on("close", function () {
        debugLog('server closed : all connections have ended');
    }).on("error", function (err) {
        debugLog('server error: ', err.message);
    });

}
util.inherits(OPCUAServerEndPoint, EventEmitter);


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
 * @method _registerChannel
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._registerChannel = function (channel) {
    var self = this;
    self._channels[channel.securityToken.secureChannelId] = channel;
};

/**
 * @method _unregisterChannel
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._unregisterChannel = function (channel) {
    var self = this;
    delete self._channels[channel.securityToken.secureChannelId];
};

/**
 * @method listen
 */
OPCUAServerEndPoint.prototype.listen = function () {

    var self = this;
    self._server.listen(self.port, function () { //'listening' listener
        self._started = true;
        debugLog('server bound');
    });
};

/**
 * @method shutdown
 * @async
 * @param callback {Callback}
 */
OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    var self = this;

    function disconnect_channel(channel, inner_callback) {
        assert(_.isFunction(inner_callback));
        channel.close(function() {
            inner_callback();
            self._unregisterChannel(channel);
        });
    }

    if (self._started) {

        self._started = false;

        // filter
        var chnls = _.values(self._channels); // .filter(function(e){ return !!e; });

        async.each(chnls,disconnect_channel, function(err){

            self._server.close(function () {
                assert(Object.keys(self._channels).length === 0, "channel must have unregistered themselves");
                callback(err);
            });

        });
    } else {
        callback();
    }
};

/**
 * @method shutdown
 * @async
 * @param callback {Callback}
 */
OPCUAServerEndPoint.prototype.start = function (callback) {
    this.listen();
    process.nextTick(callback);
};



exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
