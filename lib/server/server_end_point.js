"use strict";
/**
 * @module opcua.server
 * @type {async|exports}
 */
require("requirish")._(module);
var net = require("net");
var util = require("util");
var path = require("path");
var assert = require("better-assert");
var async = require("async");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;

var s = require("lib/datamodel/structures");
var UserIdentityTokenType = s.UserIdentityTokenType;


var endpoints_service = require("lib/services/get_endpoints_service");
var MessageSecurityMode = endpoints_service.MessageSecurityMode;

var utils = require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);

var ServerSecureChannelLayer = require("lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var EndpointDescription = require("lib/services/get_endpoints_service").EndpointDescription;

var crypto_utils = require("lib/misc/crypto_utils");
var split_der = require("lib/misc/crypto_explore_certificate").split_der;

/**
 * OPCUAServerEndPoint a Server EndPoint.
 * @class OPCUAServerEndPoint
 *
 * A sever end point is listening to one port
 *
 * @param options {Object}
 * @param options.port                                  {Number} the tcp port
 * @param options.certificateChain                      {Buffer} the DER certificate chain
 * @param options.privateKey                            {String} PEM string of the private key
 * @param [options.defaultSecureTokenLifetime=600000]   {Number} the default secure token lifetime
 * @param [options.timeout=30000]                       {Number} the  timeout for the TCP HEL/ACK transaction (in ms)
 * @param [options.maxConnections = 20 ]                {Number} the maximum number of connection allowed on the TCP server socket
 * @param options.serverInfo                            {ApplicationDescription}
 * @param [options.serverInfo.applicationUri]           {String}
 * @param [options.serverInfo.productUri]               {String}
 * @param [options.serverInfo.applicationName]          {LocalizedText}
 * @param [options.serverInfo.gatewayServerUri]         {String|null}
 * @param [options.serverInfo.discoveryProfileUri]      {String|null}
 * @param [options.serverInfo.discoveryUrls]            {String[]}
 * @param options.objectFactory
 * @constructor
 *
 * note:
 *   see OPCUA Release 1.03 part 4 page 108 7.1 ApplicationDescription
 */
function OPCUAServerEndPoint(options) {

    var self = this;

    assert(!options.hasOwnProperty("certificate"),"expecting a certificateChain instead");
    assert(options.hasOwnProperty("certificateChain"),"expecting a certificateChain");
    assert(options.hasOwnProperty("privateKey"));
    assert(typeof(options.privateKey) === "string");

    options = options || {};
    options.port = options.port || 0;

    self.port = parseInt(options.port, 10);
    assert(_.isNumber(self.port));

    self._certificateChain = options.certificateChain;
    self._privateKey = options.privateKey;

    self._channels = {};

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;

    self.maxConnections = options.maxConnections || 20;

    self.timeout = options.timeout || 30000;

    self._server = null;

    self._setup_server();


    self._endpoints = [];

    self.objectFactory = options.objectFactory;

    this.bytesWrittenInOldChannels = 0;
    this.bytesReadInOldChannels = 0;
    this.transactionsCountOldChannels = 0;
    this.securityTokenCountOldChannels = 0;

    this.serverInfo = options.serverInfo;
    assert(_.isObject(this.serverInfo));

}
util.inherits(OPCUAServerEndPoint, EventEmitter);

OPCUAServerEndPoint.prototype._dump_statistics = function () {

    var self = this;

    self._server.getConnections(function (err, count) {
        debugLog("CONCURRENT CONNECTION = ".cyan, count);
    });
    debugLog("MAX CONNECTIONS = ".cyan, self._server.maxConnections);
};


OPCUAServerEndPoint.prototype._setup_server = function () {
    var self = this;

    assert(self._server === null);
    self._server = net.createServer(self._on_client_connection.bind(self));

    //xx console.log(" Server with max connections ", self.maxConnections);
    self._server.maxConnections = self.maxConnections + 1; // plus one extra

    self._listen_callback = null;
    self._server.on("connection", function (socket) {

        // istanbul ignore next
        if (doDebug) {
            self._dump_statistics();
            debugLog("server connected  with : " + socket.remoteAddress + ":" + socket.remotePort);
        }


    }).on("close", function () {
        debugLog("server closed : all connections have ended");
    }).on("error", function (err) {
        // this could be because the port is already in use
        console.log("server error: ".red.bold, err.message);
    });
};

var moment = require("moment");
function dumpChannelInfo(channels) {

    function dumpChannel(channel) {

        console.log("------------------------------------------------------");
        console.log("      secureChannelId = ",channel.secureChannelId);
        console.log("             timeout  = ",  channel.timeout );
        console.log("        remoteAddress = ", channel.remoteAddress);
        console.log("        remotePort    = ", channel.remotePort);
        console.log("");
        console.log("        bytesWritten  = ", channel.bytesWritten);
        console.log("        bytesRead     = ", channel.bytesRead);

        console.log("   lastTransactionTime= ", channel.transport.lastTransactionTime,
            moment(channel.transport.lastTransactionTime).fromNow());

        var socket = channel.transport._socket;
        if (!socket) {
            console.log(" SOOKET IS CLOSED");
        } else {
        }
        //xx channel._dump_transaction_statistics();

    }
    _.forEach(channels,dumpChannel);
}
/**
 * @async
 * @param self
 * @param establish_connection
 * @private
 */
function _prevent_DOS_Attack(self, establish_connection) {

    var nbConnections = self.activeChannelCount;

    if (nbConnections >= self.maxConnections) {
        // istanbul ignore next
        if (doDebug) {
            console.log(" PREVENTING DOS ATTACK => Closing unused channels".bgRed.white);
        }
        var unused_channels = _.filter(self._channels, function (channel) {
            return !channel.isOpened && !channel.hasSession;
        });
        if (unused_channels.length === 0) {
            // all channels are in used , we cannot get any

            // istanbul ignore next
            if (doDebug) {
                console.log("  - all channel are used !!!!");
                dumpChannelInfo(self._channels);
            }
            setImmediate(establish_connection);
            return;
        }
        // istanbul ignore next
        if (doDebug) {
            console.log("   - Unused channels that can be clobbered", _.map(unused_channels, function (channel) {
                return channel.hashKey;
            }).join(" "));
        }
        var channel = unused_channels[0];
        channel.close(function () {
            // istanbul ignore next
            if (doDebug) {
                console.log("   _ Unused channel has been closed ", channel.hashKey);
            }
            self._unregisterChannel(channel);

            establish_connection();
        });
    } else {
        setImmediate(establish_connection);
    }
}


OPCUAServerEndPoint.prototype._on_client_connection = function (socket) {

    // a client is attempting a connection on the socket
    var self = this;

    debugLog("OPCUAServerEndPoint#_on_client_connection", self._started);
    if (!self._started) {
        debugLog("OPCUAServerEndPoint#_on_client_connection SERVER END POINT IS PROBABLY SHUTTING DOWN !!! - Connection is refused".bgWhite.cyan);
        socket.end();
        return;
    }

    // Each SecureChannel exists until it is explicitly closed or until the last token has expired and the overlap
    // period has elapsed. A Server application should limit the number of SecureChannels. 
    // To protect against misbehaving Clients and denial of service attacks, the Server shall close the oldest 
    // SecureChannel that has no Session assigned before reaching the maximum number of supported SecureChannels.         
    _prevent_DOS_Attack(self, establish_connection);

    function establish_connection() {

        var nbConnections = Object.keys(self._channels).length;
        debugLog(" nbConnections ", nbConnections, " self._server.maxConnections", self._server.maxConnections, self.maxConnections);
        if (nbConnections >= self.maxConnections) {
            console.log("OPCUAServerEndPoint#_on_client_connection The maximum number of connection has been reached - Connection is refused".bgWhite.cyan);
            socket.end();
            return;
        }

        debugLog("OPCUAServerEndPoint._on_client_connection successful => New Channel");

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
                debugLog("server receiving a client connection");
            }
        });


        channel.on("message", function (message) {
            // forward
            self.emit("message", message, channel, self);
        });

    }

};

/**
 * @method getCertificate
 * Returns the X509 DER form of the server certificate
 * @return {Buffer}
 */
OPCUAServerEndPoint.prototype.getCertificate1 = function () {
    return split_der(this._certificateChain)[0];
};
/**
 * @method getCertificateChain
 * Returns the X509 DER form of the server certificate
 * @return {Buffer}
 */
OPCUAServerEndPoint.prototype.getCertificateChain = function () {
    return this._certificateChain;
};
/**
 *
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
OPCUAServerEndPoint.prototype.getPrivateKey = function () {
    return this._privateKey;
};

/**
 * The number of active channel on this end point.
 * @property currentChannelCount
 * @type {Number}
 */
OPCUAServerEndPoint.prototype.__defineGetter__("currentChannelCount", function () {
    return Object.keys(this._channels).length;
});

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;


var get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;

var default_transportProfileUri = "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";

/**
 * @method _makeEndpointDescription
 * @param options.port
 * @param options.serverCertificate
 * @param options.securityMode
 * @param options.securityPolicy
 * @param options.securityLevel              {Number}
 * @param options.server.applicationUri      {String}
 * @param options.server.productUri          {String}
 * @param options.server.applicationName     {LocalizedText} // {text: "SampleServer", locale: null},
 * @param options.server.applicationType     {ApplicationType}
 * @param options.server.gatewayServerUri    {String}
 * @param options.server.discoveryProfileUri {String}
 * @param options.server.discoveryUrls       {String}
 * @param [options.resourcePath=""]          {String} resource Path is a string added at the end of the url such as "/UA/Server"
 * @param [options.hostname=get_fully_qualified_domain_name()] {string} default hostname
 * @return {EndpointDescription}
 * @private
 */
function _makeEndpointDescription(options) {

    assert(_.isFinite(options.port), "expecting a valid port number");
    assert(options.hasOwnProperty("serverCertificateChain"));
    assert(!options.hasOwnProperty("serverCertificate"));
    assert(options.securityMode); // s.MessageSecurityMode
    assert(options.securityPolicy);
    assert(_.isObject(options.securityPolicy));
    assert(_.isObject(options.server));
    assert(options.hostname && (typeof options.hostname === "string"));

    options.securityLevel = ( options.securityLevel === undefined) ? 3 : options.securityLevel;
    assert(_.isFinite(options.securityLevel), "expecting a valid securityLevel");

    var securityPolicyUri = securityPolicy_m.toURI(options.securityPolicy);

    // resource Path is a string added at the end of the url such as "/UA/Server"
    var resourcePath = options.resourcePath || "";

    var userIdentityTokens = [];

    if (options.securityPolicy === SecurityPolicy.None) {

        userIdentityTokens.push({
            policyId: "username_basic256",
            tokenType: UserIdentityTokenType.USERNAME,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic256.value
        });

        userIdentityTokens.push({
            policyId: "username_basic128",
            tokenType: UserIdentityTokenType.USERNAME,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic128Rsa15.value
        });

    } else {
        // note:
        //  when channel session security is not NONE,
        //  userIdentityTokens can be left to null.
        //  in this case this mean that secure policy will be the same as connection security policy
        userIdentityTokens.push({
            policyId: "usernamePassword",
            tokenType: UserIdentityTokenType.USERNAME,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }

    if (options.allowAnonymous) {

        userIdentityTokens.push({
            policyId: "anonymous",
            tokenType: UserIdentityTokenType.ANONYMOUS,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }

    var endpointUrl = "opc.tcp://" + options.hostname + ":" + path.join("" + options.port, resourcePath).replace(/\\/g, "/");
    // return the endpoint object
    var endpoint = new EndpointDescription({

        endpointUrl: endpointUrl,
        server: options.server,
        serverCertificate: options.serverCertificateChain,
        securityMode: options.securityMode,
        securityPolicyUri: securityPolicyUri,
        userIdentityTokens: userIdentityTokens,
        transportProfileUri: default_transportProfileUri,
        securityLevel: options.securityLevel
    });

    return endpoint;

}

/**
 * @method matching_endpoint
 * @param endpoint
 * @param securityMode
 * @param securityPolicy
 * @return {Boolean}
 *
 */
function matching_endpoint(securityMode, securityPolicy, endpoint) {

    assert(endpoint instanceof EndpointDescription);
    assert(_.isObject(securityMode));
    assert(_.isObject(securityPolicy));
    var endpoint_securityPolicy = securityPolicy_m.fromURI(endpoint.securityPolicyUri);
    return (endpoint.securityMode.value === securityMode.value && endpoint_securityPolicy.value === securityPolicy.value);
}

/**
 * @method getEndpointDescription
 * @param securityMode
 * @param securityPolicy
 * @return endpoint_description {EndpointDescription|null}
 */
OPCUAServerEndPoint.prototype.getEndpointDescription = function (securityMode, securityPolicy) {

    var self = this;
    var endpoints = self.endpointDescriptions();
    var arr = _.filter(endpoints, matching_endpoint.bind(this, securityMode, securityPolicy));
    assert(arr.length === 0 || arr.length === 1);
    return arr.length === 0 ? null : arr[0];
};

OPCUAServerEndPoint.prototype.addEndpointDescription = function (securityMode, securityPolicy, options) {

    var self = this;

    options = options || {};
    options.allowAnonymous = ( options.allowAnonymous === undefined ) ? true : options.allowAnonymous;

    assert(_.isObject(securityMode));
    assert(_.isObject(securityPolicy));

    if (securityPolicy !== SecurityPolicy.None) {
        // istanbul ignore next
        if (!crypto_utils.isFullySupported()) {
            console.log(" Warning ! your node-js version doesn't not support crypto");
            console.log(" securityPolicy ", securityPolicy.toString(), "cannot be defined");
        }
    }
    if (securityMode === MessageSecurityMode.NONE && securityPolicy !== SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    if (securityMode !== MessageSecurityMode.NONE && securityPolicy === SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    //
    var endpoint_desc = self.getEndpointDescription(securityMode, securityPolicy);
    if (endpoint_desc) {
        throw new Error(" endpoint already exist");
    }
    var port = self.port;

    options.hostname = options.hostname || get_fully_qualified_domain_name();

    self._endpoints.push(_makeEndpointDescription(
        {
            port: port,
            server: self.serverInfo,
            serverCertificateChain: self.getCertificateChain(),
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            allowAnonymous: options.allowAnonymous,
            resourcePath: options.resourcePath,
            hostname: options.hostname
        }));

};

OPCUAServerEndPoint.prototype.addStandardEndpointDescriptions = function (options) {

    var self = this;

    options = options || {};

    options.securityModes = options.securityModes || [MessageSecurityMode.NONE, MessageSecurityMode.SIGN, MessageSecurityMode.SIGNANDENCRYPT];
    options.securityPolicies = options.securityPolicies || [SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256];

    if (options.securityModes.indexOf(MessageSecurityMode.NONE) >= 0) {
        self.addEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None, options);
    }

    if (crypto_utils.isFullySupported()) {

        for (var i = 0; i < options.securityModes.length; i++) {
            var securityMode = options.securityModes[i];
            if (securityMode === MessageSecurityMode.NONE) {
                continue;
            }

            for (var j = 0; j < options.securityPolicies.length; j++) {
                var securityPolicy = options.securityPolicies[j];
                if (securityPolicy === SecurityPolicy.None) {
                    continue;
                }
                self.addEndpointDescription(securityMode, securityPolicy, options);
            }
        }
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


    if (self._started) {

        debugLog("_registerChannel = ".red, "channel.hashKey = ", channel.hashKey);

        assert(self._channels[channel.hashKey] === undefined);
        self._channels[channel.hashKey] = channel;

        channel._rememberClientAddressAndPort();
        /**
         * @event newChannel
         * @param channel
         */
        self.emit("newChannel", channel);

        channel.on("abort", function () {
           self._unregisterChannel(channel);
        });

    } else {
        debugLog("OPCUAServerEndPoint#_registerChannel called when end point is shutdown !");
        debugLog("  -> channel will be forcefully terminated");
        channel.close();
    }
};

/**
 * @method _unregisterChannel
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._unregisterChannel = function (channel) {

    var self = this;
    debugLog("_un-registerChannel channel.hashKey", channel.hashKey);

    if (!self._channels.hasOwnProperty(channel.hashKey)) {
        return;
    }

    assert(self._channels.hasOwnProperty(channel.hashKey), "channel is not registered");

    /**
     * @event closeChannel
     * @param channel
     */
    self.emit("closeChannel", channel);

    // keep trace of statistics data from old channel for our own accumulated stats.
    self.bytesWrittenInOldChannels += channel.bytesWritten;
    self.bytesReadInOldChannels += channel.bytesRead;
    self.transactionsCountOldChannels += channel.transactionsCount;
    delete self._channels[channel.hashKey];

    //istanbul ignore next
    if (doDebug) {
        self._dump_statistics();
        debugLog("un-registering channel  - Count = ", self.currentChannelCount);
    }
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

    var self = this;
    assert(_.isFunction(callback));
    assert(!self._started, "OPCUAServerEndPoint is already listening");

    self._listen_callback = callback;

    self._server.on("error", function (err) {
        debugLog(" error".red.bold + " port = " + self.port, err);
        self._started = false;
        self._end_listen(err);
    });

    self._server.listen(self.port, function (err) { //'listening' listener
        debugLog("LISTENING TO PORT ".green.bold, self.port, "err  ", err);
        assert(!err, " cannot listen to port ");
        self._started = true;
        self._end_listen();
    });
};


OPCUAServerEndPoint.prototype.suspendConnection = function (callback) {

    var self = this;
    assert(self._started);
    self._server.close(function () {
//xx        assert(self._started);
        self._started = false;
    });
    self._started = false;
    callback();
};

OPCUAServerEndPoint.prototype.restoreConnection = function (callback) {
    var self = this;
    self.listen(callback);
};

/**
 *
 * @param channel
 * @param inner_callback
 */
function shutdown_channel(channel, inner_callback) {
    var self = this;
    assert(_.isFunction(inner_callback));

    channel.on("close", function () {
        console.log(" ON CLOSED !!!!");
        //xx setImmediate(inner_callback);
    });

    channel.close(function () {
        inner_callback();
        self._unregisterChannel(channel);
    });
}

/**
 * @method shutdown
 * @async
 * @param callback {Function}
 */
OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    var self = this;

    if (self._started) {
        // make sure we don't accept new connection any more ...
        self.suspendConnection(function () {
            // shutdown all opened channels ...
            var _channels = _.values(self._channels);
            async.each(_channels, shutdown_channel.bind(self), function (err) {
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

OPCUAServerEndPoint.prototype.__defineGetter__("bytesWritten", function () {
    var chnls = _.values(this._channels);
    return this.bytesWrittenInOldChannels + chnls.reduce(
            function (accumulated, channel) {
                return accumulated + channel.bytesWritten;
            }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("bytesRead", function () {
    var chnls = _.values(this._channels);
    return this.bytesReadInOldChannels + chnls.reduce(
            function (accumulated, channel) {
                return accumulated + channel.bytesRead;
            }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("transactionsCount", function () {
    var chnls = _.values(this._channels);
    return this.transactionsCountOldChannels + chnls.reduce(
            function (accumulated, channel) {
                return accumulated + channel.transactionsCount;
            }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("securityTokenCount", function () {
    var chnls = _.values(this._channels);
    return this.securityTokenCountOldChannels + chnls.reduce(
            function (accumulated, channel) {
                return accumulated + channel.securityTokenCount;
            }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("activeChannelCount", function () {
    var self = this;
    return Object.keys(self._channels).length;
});

exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
