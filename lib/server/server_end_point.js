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


/**
 * @property currentChannelCount {Number} returns the number of active channel on this end point
 */
OPCUAServerEndPoint.prototype.__defineGetter__("currentChannelCount", function () {
    return Object.keys(this._channels).length;

});


//

function _makeEndpointDescription(port,serverCertificate,securityMode) {

    var securityPolicyUri;
    switch(securityMode) {
        case s.MessageSecurityMode.NONE:
            securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
            break;
        case s.MessageSecurityMode.SIGN:
            securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#Basic256";
            break;
        default:
            assert(securityMode.key == s.MessageSecurityMode.SIGNANDENCRYPT.key);
            securityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15";
            break;
    };

    var hostname = require("os").hostname().toLowerCase();

    // return the endpoint object
    var endpoint = new s.EndpointDescription({

        endpointUrl: "opc.tcp://" + hostname + ":" + port + "/UA/SampleServer",

        server: {
            applicationUri: "SampleServer",
            productUri: "SampleServer",
            applicationName: { text: "SampleServer", locale: null },
            applicationType: s.ApplicationType.SERVER,
            gatewayServerUri: "",
            discoveryProfileUri: "",
            discoveryUrls: []
        },

        serverCertificate: serverCertificate,
        securityMode:  securityMode,
        securityPolicyUri: securityPolicyUri,

        userIdentityTokens: [
            {
                policyId: "0",
                tokenType: s.UserIdentityTokenType.ANONYMOUS,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            },
            {
                policyId: "1",
                tokenType: s.UserIdentityTokenType.USERNAME,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            },
            {
                policyId: "2",
                tokenType: s.UserIdentityTokenType.CERTIFICATE,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            }
        ],
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
        securityLevel: 3
    });

    return endpoint;

}


OPCUAServerEndPoint.prototype.endpointDescriptions = function () {

    var self = this;
    var server = self.server;

    if (!self._endpoints) {
        self._endpoints = [];
        var port = self.port;
        var cert = server.getCertificate();
        self._endpoints.push(_makeEndpointDescription(port,cert,s.MessageSecurityMode.NONE));
        self._endpoints.push(_makeEndpointDescription(port,cert,s.MessageSecurityMode.SIGN));
        self._endpoints.push(_makeEndpointDescription(port,cert,s.MessageSecurityMode.SIGNANDENCRYPT));
    }
    return  self._endpoints;
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
