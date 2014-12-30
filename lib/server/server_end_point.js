/**
 * @module opcua.server
 * @type {async|exports}
 */
require("requirish")._(module);
var net = require("net");
var util = require("util");
var assert = require("better-assert");
var async = require("async");
var _ = require("underscore");
var crypto = require("crypto");
var EventEmitter = require("events").EventEmitter;

var s = require("lib/datamodel/structures");
var UserIdentityTokenType = s.UserIdentityTokenType;


var endpoints_service = require("lib/services/get_endpoints_service");
var MessageSecurityMode =endpoints_service.MessageSecurityMode;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var hexDump = require("lib/misc/utils").hexDump;
var messageHeaderToString = require("lib/misc/message_header").messageHeaderToString;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var ServerSecureChannelLayer = require("lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var ServerEngine = require("lib/server/server_engine").ServerEngine;
var browse_service = require("lib/services/browse_service");
var read_service = require("lib/services/read_service");

var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;

var EndpointDescription =  require("lib/services/get_endpoints_service").EndpointDescription;

/**
 * OPCUAServerEndPoint a Server EndPoint.
 * @class OPCUAServerEndPoint
 *
 * A sever end point is listening to one port
 *
 * @param server {OPCUABaseServer} the opcua server
 * @param port   {Number} the tcp port
 * @param options {Object}
 * @param [options.defaultSecureTokenLifetime=30000] the default secure token lifetime
 * @param [options.timeout=3000] the  timeout for the TCP HEL/ACK transaction
 *
 * @constructor
 */
function OPCUAServerEndPoint(server, port, options) {

    options = options || {};
    var self = this;
    self.port = parseInt(port, 10);

    self.server = server;
    //xx assert(self.server instanceof OPCUABaseServer);

    self._channels = {};

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    self.timeout = options.timeout || 10000;

    self._server = net.createServer(self._on_client_connection.bind(this));

    self._listen_callback = null;
    self._server.on("connection", function (socket) {
        debugLog('server connected  with : ' + socket.remoteAddress + ':' + socket.remotePort);
    }).on("close", function () {
        debugLog('server closed : all connections have ended');
    }).on("error", function (err) {
        // this could be because the port is already in use
        console.log('server error: '.red.bold, err.message);
    });

}
util.inherits(OPCUAServerEndPoint, EventEmitter);

OPCUAServerEndPoint.prototype._on_client_connection = function (socket) {

    // a client is attempting a connection on the socket
    var self = this;

    var channel = new ServerSecureChannelLayer({
        parent: self,
        timeout: self.timeout,
        defaultSecureTokenLifetime: self.defaultSecureTokenLifetime
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
        self.emit("message", message, channel, self);
    });

    channel.on("abort", function () {
        // the channel has aborted
        self._unregisterChannel(channel);
    });

};

/**
 * Returns the X509 DER form of the server certificate
 * @return {Buffer}
 */
OPCUAServerEndPoint.prototype.getCertificate = function () {
    return this.server.getCertificate();
};

///**
// * Returns the X509 DER form of the server certificate
// * @return {Buffer}
// */
//OPCUAServerEndPoint.prototype.getCertificate256 = function () {
//    return this.server.getCertificate256();
//};
//
/**
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
OPCUAServerEndPoint.prototype.getPrivateKey = function () {
    return this.server.getPrivateKey();
};

///**
// /**
// * @method getPrivateKey256
// * @return {Buffer} the privateKey
// */
//OPCUAServerEndPoint.prototype.getPrivateKey256 = function () {
//    return this.server.getPrivateKey256();
//};


/**
 * The number of active channel on this end point.
 * @property currentChannelCount
 * @type {Number}
 */
OPCUAServerEndPoint.prototype.__defineGetter__("currentChannelCount", function () {
    return Object.keys(this._channels).length;

});

var SecurityPolicy = require("lib/misc/security_policy").SecurityPolicy;


function _makeEndpointDescription(port, serverCertificate, securityMode, securityPolicy) {

    assert(securityMode); // s.MessageSecurityMode
    assert(securityPolicy);// instanceof SecurityPolicy

    var securityPolicyUri = SecurityPolicy.toURI(securityPolicy);

    var hostname = require("os").hostname().toLowerCase();


    // return the endpoint object
    var endpoint = new EndpointDescription({

        endpointUrl: "opc.tcp://" + hostname + ":" + port + "/UA/SampleServer",

        server: {
            applicationUri: "urn:NodeOPCUA-Server",
            productUri: "SampleServer",
            applicationName: {text: "SampleServer", locale: null},
            applicationType: s.ApplicationType.SERVER,
            gatewayServerUri: "",
            discoveryProfileUri: "",
            discoveryUrls: []
        },

        serverCertificate: serverCertificate,
        securityMode: securityMode,
        securityPolicyUri: securityPolicyUri,

        userIdentityTokens: [
            {
                policyId: "0",
                tokenType: UserIdentityTokenType.ANONYMOUS,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            },
            {
                policyId: "1",
                tokenType: UserIdentityTokenType.USERNAME,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            },
            {
                policyId: "2",
                tokenType: UserIdentityTokenType.CERTIFICATE,
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


/**
 * returns the list of end point descriptions.
 * @method endpointDescriptions
 * @return {Array}
 */
OPCUAServerEndPoint.prototype.endpointDescriptions = function () {

    var self = this;

    if (!self._endpoints) {
        self._endpoints = [];
        var port = self.port;

        // install endpoint with 1024 bits cryptology
        var cert = self.getCertificate();
        self._endpoints.push(_makeEndpointDescription(port, cert, MessageSecurityMode.NONE, SecurityPolicy.None));


        var crypto_utils = require("lib/misc/crypto_utils");
        if (!crypto_utils.isFullySupported()) {

            self._endpoints.push(_makeEndpointDescription(port, cert, MessageSecurityMode.SIGN, SecurityPolicy.Basic128Rsa15));
            self._endpoints.push(_makeEndpointDescription(port, cert, MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic128Rsa15));
            self._endpoints.push(_makeEndpointDescription(port, cert, MessageSecurityMode.SIGN, SecurityPolicy.Basic256));
            self._endpoints.push(_makeEndpointDescription(port, cert, MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256));

        }
    }
    return self._endpoints;
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

OPCUAServerEndPoint.prototype._end_listen = function (err) {

    var self = this;
    assert(_.isFunction(self._listen_callback));
    self._listen_callback(err);
    self._listen_callback = null;
};

/**
 * @method listen
 * @async
 */
OPCUAServerEndPoint.prototype.listen = function (callback) {

    assert(_.isFunction(callback));
    var self = this;

    self._listen_callback = callback;

    self._server.on("error", function (err) {
        console.log(" error".red.bold + " port = " + self.port, err);
        self._end_listen(err);
    });

    self._server.listen(self.port, function () { //'listening' listener

        console.log("  LISTENING TO PORT ".green.bold, self.port);
        self._started = true;
        debugLog('server is started and is now listening');
        self._end_listen();
    });
};

/**
 * @method shutdown
 * @async
 * @param callback {Function}
 */
OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    var self = this;

    function disconnect_channel(channel, inner_callback) {
        assert(_.isFunction(inner_callback));
        channel.close(function () {
            inner_callback();
            self._unregisterChannel(channel);
        });
    }

    if (self._started) {

        self._started = false;

        // filter
        var chnls = _.values(self._channels); // .filter(function(e){ return !!e; });

        async.each(chnls, disconnect_channel, function (err) {

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
 * @method start
 * @async
 * @param callback {Function}
 */
OPCUAServerEndPoint.prototype.start = function (callback) {
    assert(_.isFunction(callback));
    this.listen(callback);
};


exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
