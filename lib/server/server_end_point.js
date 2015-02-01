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

var crypto_utils = require("lib/misc/crypto_utils");

/**
 * OPCUAServerEndPoint a Server EndPoint.
 * @class OPCUAServerEndPoint
 *
 * A sever end point is listening to one port
 *
 * @param port   {Number} the tcp port
 * @param options {Object}
 * @param options.certificate  {Buffer} the DER certificate
 * @param options.privateKey   {String} PEM string of the private key
 * @param [options.defaultSecureTokenLifetime=30000] the default secure token lifetime
 * @param [options.timeout=3000] the  timeout for the TCP HEL/ACK transaction
 * @param options.objectFactory
 * @constructor
 */
function OPCUAServerEndPoint(port, options) {

    options = options || {};
    var self = this;
    self.port = parseInt(port, 10);
    assert(_.isFinite(self.port));

    self.certificate = options.certificate;
    self.privateKey  = options.privateKey;

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

    self._endpoints = [];

    self.objectFactory = options.objectFactory;

    this.bytesWrittenInOldChannels = 0;
    this.bytesReadInOldChannels = 0;
    this.transactionsCountOldChannels = 0;
    this.securityTokenCountOldChannels = 0;

}
util.inherits(OPCUAServerEndPoint, EventEmitter);

OPCUAServerEndPoint.prototype._on_client_connection = function (socket) {

    // a client is attempting a connection on the socket
    var self = this;

    var channel = new ServerSecureChannelLayer({
        parent: self,
        timeout: self.timeout,
        defaultSecureTokenLifetime: self.defaultSecureTokenLifetime,
        objectFactory: self.objectFactory
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
    return this.certificate;
};

/**
 * return
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
OPCUAServerEndPoint.prototype.getPrivateKey = function () {
    return this.privateKey;
};

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
 *
 * @param endpoint
 * @param securityMode
 * @param securityPolicy
 */
function matching_endpoint(securityMode,securityPolicy,endpoint) {

    assert(endpoint instanceof EndpointDescription);
    assert(_.isObject(securityMode));
    assert(_.isObject(securityPolicy));
    var endpoint_securityPolicy = SecurityPolicy.fromURI(endpoint.securityPolicyUri);
    return (endpoint.securityMode.value === securityMode.value && endpoint_securityPolicy.value === securityPolicy.value);
}

/**
 * @method get_endpoint_for_security_mode_and_policy
 * @param securityMode
 * @param securityPolicy
 */
OPCUAServerEndPoint.prototype.get_endpoint_for_security_mode_and_policy = function(securityMode,securityPolicy) {

    var self = this;
    var endpoints = self.endpointDescriptions();
    return _.filter(endpoints,matching_endpoint.bind(this,securityMode,securityPolicy));

};

OPCUAServerEndPoint.prototype.addEndpointDescription = function (securityMode,securityPolicy) {

    var self = this;

    //xx console.log("certificate = ",certificate);
    //xx console.log("privateKey = ",privateKey);
    //xx assert(_.isObject(certificate) || certificate === null);
    //xx assert(_.isObject(privateKey)  || privateKey === null);

    assert(_.isObject(securityMode));
    assert(_.isObject(securityPolicy));

    if (securityPolicy !== SecurityPolicy.None) {
        if (!crypto_utils.isFullySupported()) {
            console.log(" Warning ! your nodejs version doesn't not support Crypto");
            console.log(" securityPolicy ",securityPolicy.toString(), "cannot be defined");
       }
    }
    if (securityMode === MessageSecurityMode.NONE && securityPolicy !== SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    if (securityMode !== MessageSecurityMode.NONE && securityPolicy === SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    //
    var existing_endpoints = self.get_endpoint_for_security_mode_and_policy(securityMode,securityPolicy);
    if (existing_endpoints.length>0) {
        throw new Error(" endpoint already exist");
    }
    var port = self.port;

    self._endpoints.push(_makeEndpointDescription(port, self.certificate, securityMode,securityPolicy) );

};

OPCUAServerEndPoint.prototype.addStandardEndpointDescription = function() {

    var self = this;


    self.addEndpointDescription( MessageSecurityMode.NONE, SecurityPolicy.None);

    if (crypto_utils.isFullySupported()) {
        self.addEndpointDescription(MessageSecurityMode.SIGN,           SecurityPolicy.Basic128Rsa15);
        self.addEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic128Rsa15);
        self.addEndpointDescription(MessageSecurityMode.SIGN,           SecurityPolicy.Basic256);
        self.addEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256);
    }

};

/**
 * returns the list of end point descriptions.
 * @method endpointDescriptions
 * @return {Array}
 */
OPCUAServerEndPoint.prototype.endpointDescriptions = function () {
    var self = this;
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
    // keep trace of statistics data from old channel for our own accumulated stats.
    self.bytesWrittenInOldChannels += channel.bytesWritten;
    self.bytesReadInOldChannels   += channel.bytesRead;
    self.transactionsCountOldChannels += channel.transactionsCount;
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

OPCUAServerEndPoint.prototype.__defineGetter__("bytesWritten",function() {

    var chnls = _.values(this._channels);
    return this.bytesWrittenInOldChannels + chnls.reduce(function(accumulated,channel) { return accumulated + channel.bytesWritten},0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("bytesRead",function() {
    var chnls = _.values(this._channels);
    return  this.bytesReadInOldChannels + chnls.reduce(function(accumulated,channel) { return accumulated + channel.bytesRead},0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("transactionsCount",function() {
    var chnls = _.values(this._channels);
    return  this.transactionsCountOldChannels + chnls.reduce(function(accumulated,channel) { return accumulated + channel.transactionsCount},0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("securityTokenCount",function() {
    var chnls = _.values(this._channels);
    return  this.securityTokenCountOldChannels + chnls.reduce(function(accumulated,channel) { return accumulated + channel.securityTokenCount},0);
});
exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
