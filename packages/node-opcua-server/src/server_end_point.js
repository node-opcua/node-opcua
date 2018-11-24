"use strict";
/**
 * @module opcua.server
 * @type {async|exports}
 */

const net = require("net");
const util = require("util");
const path = require("path");
const assert = require("node-opcua-assert").assert;
const async = require("async");
const _ = require("underscore");
const EventEmitter = require("events").EventEmitter;
const chalk = require("chalk");

const UserTokenType = require("node-opcua-service-endpoints").UserTokenType;
const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
const fromURI = require("node-opcua-secure-channel").fromURI;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const ServerSecureChannelLayer = require("node-opcua-secure-channel").ServerSecureChannelLayer;
const toURI = require("node-opcua-secure-channel").toURI;


const EndpointDescription = require("node-opcua-service-endpoints").EndpointDescription;

const split_der = require("node-opcua-crypto").split_der;

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

    const self = this;

    assert(!options.hasOwnProperty("certificate"), "expecting a certificateChain instead");
    assert(options.hasOwnProperty("certificateChain"), "expecting a certificateChain");
    assert(options.hasOwnProperty("privateKey"));
    //xx assert(typeof(options.privateKey) === "string");

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

    self.bytesWrittenInOldChannels = 0;
    self.bytesReadInOldChannels = 0;
    self.transactionsCountOldChannels = 0;
    self.securityTokenCountOldChannels = 0;

    self.serverInfo = options.serverInfo;
    assert(_.isObject(self.serverInfo));

}

util.inherits(OPCUAServerEndPoint, EventEmitter);

OPCUAServerEndPoint.prototype.dispose = function() {

    const self = this;
    self._certificateChain = null;
    self._privateKey = null;

    assert(Object.keys(self._channels).length === 0,"OPCUAServerEndPoint channels must have been deleted");
    self._channels = {};
    self.serverInfo = null;

    self._endpoints = [];
    assert(self._endpoints.length === 0, "endpoints must have been deleted");
    self._endpoints = null;

    self._server = null;
    self._listen_callback = null;

    self.removeAllListeners();

};
OPCUAServerEndPoint.prototype._dump_statistics = function () {

    const self = this;

    self._server.getConnections(function (err, count) {
        debugLog("CONCURRENT CONNECTION = ".cyan, count);
    });
    debugLog("MAX CONNECTIONS = ".cyan, self._server.maxConnections);
};


OPCUAServerEndPoint.prototype._setup_server = function () {

    assert(this._server === null);
    this._server = net.createServer({ pauseOnConnect: true}, this._on_client_connection.bind(this));

    //xx console.log(" Server with max connections ", self.maxConnections);
    this._server.maxConnections = this.maxConnections + 1; // plus one extra

    this._listen_callback = null;
    this._server.on("connection",  (socket)  => {

        // istanbul ignore next
        if (doDebug) {
            this._dump_statistics();
            debugLog("server connected  with : " + socket.remoteAddress + ":" + socket.remotePort);
        }

    }).on("close", function () {
        debugLog("server closed : all connections have ended");
    }).on("error", function (err) {
        // this could be because the port is already in use
        debugLog("server error: ".red.bold, err.message);
    });
};

function dumpChannelInfo(channels) {

    function dumpChannel(channel) {

        console.log("------------------------------------------------------");
        console.log("            channelId = ", channel.channelId);
        console.log("             timeout  = ", channel.timeout);
        console.log("        remoteAddress = ", channel.remoteAddress);
        console.log("        remotePort    = ", channel.remotePort);
        console.log("");
        console.log("        bytesWritten  = ", channel.bytesWritten);
        console.log("        bytesRead     = ", channel.bytesRead);
        
        const socket = channel.transport._socket;
        if (!socket) {
            console.log(" SOCKET IS CLOSED");
        }
    }

    _.forEach(channels, dumpChannel);
}

/**
 * @method _prevent_DOS_Attack
 * @async
 * @param self
 * @param establish_connection
 * @private
 */
function _prevent_DDOS_Attack(self, establish_connection) {

    const nbConnections = self.activeChannelCount;

    if (nbConnections >= self.maxConnections) {
        // istanbul ignore next
        if (doDebug) {
            console.log(" PREVENTING DOS ATTACK => Closing unused channels".bgRed.white);
        }
        const unused_channels = _.filter(self._channels, function (channel) {
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
        const channel = unused_channels[0];
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
    const self = this;

    socket.setNoDelay(true);

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
    _prevent_DDOS_Attack(self, establish_connection);

    function establish_connection() {

        const nbConnections = Object.keys(self._channels).length;
        debugLog(" nbConnections ", nbConnections, " self._server.maxConnections", self._server.maxConnections, self.maxConnections);
        if (nbConnections >= self.maxConnections) {
            debugLog(chalk.bgWhite.cyan("OPCUAServerEndPoint#_on_client_connection The maximum number of connection has been reached - Connection is refused"));
            socket.end();
            socket.destroy();
            return;
        }

        debugLog("OPCUAServerEndPoint._on_client_connection successful => New Channel");

        const channel = new ServerSecureChannelLayer({
            parent: self,
            timeout: self.timeout,
            defaultSecureTokenLifetime: self.defaultSecureTokenLifetime,
            objectFactory: self.objectFactory
        });

        socket.resume();

        self._preregisterChannel(channel);

        channel.init(socket, function (err) {
            self._unpreregisterChannel(channel);
            debugLog("Channel#init done".yellow.bold,err);
            if (err) {
                socket.end();
            } else {
                debugLog("server receiving a client connection");
                self._registerChannel(channel);
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
 * @return {PrivateKey} the privateKey
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

const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;


const get_fully_qualified_domain_name = require("node-opcua-hostname").get_fully_qualified_domain_name;

const default_transportProfileUri = "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";

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
    assert(_.isObject(options.server));
    assert(options.hostname && (typeof options.hostname === "string"));
    assert(_.isBoolean(options.restricted));

    options.securityLevel = (options.securityLevel === undefined) ? 3 : options.securityLevel;
    assert(_.isFinite(options.securityLevel), "expecting a valid securityLevel");

    const securityPolicyUri = toURI(options.securityPolicy);

    // resource Path is a string added at the end of the url such as "/UA/Server"
    const resourcePath = options.resourcePath || "";

    const userIdentityTokens = [];

    if (options.securityPolicy === SecurityPolicy.None) {

        userIdentityTokens.push({
            policyId: "username_basic256",
            tokenType: UserTokenType.UserName,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic256
        });

        userIdentityTokens.push({
            policyId: "username_basic128",
            tokenType: UserTokenType.UserName,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic128Rsa15
        });

        userIdentityTokens.push({
            policyId: "username_basic256Sha256",
            tokenType: UserTokenType.UserName,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic256Sha256
        });

        userIdentityTokens.push({
            policyId: "certificate_basic256Sha256",
            tokenType: UserTokenType.Certificate,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: SecurityPolicy.Basic256Sha256
        });

    } else {
        // note:
        //  when channel session security is not "None",
        //  userIdentityTokens can be left to null.
        //  in this case this mean that secure policy will be the same as connection security policy
        userIdentityTokens.push({
            policyId: "usernamePassword",
            tokenType: UserTokenType.UserName,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }

    if (options.allowAnonymous) {

        userIdentityTokens.push({
            policyId: "anonymous",
            tokenType: UserTokenType.Anonymous,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }

    const endpointUrl = "opc.tcp://" + options.hostname + ":" + path.join("" + options.port, resourcePath).replace(/\\/g, "/");
    // return the endpoint object
    const endpoint = new EndpointDescription({

        endpointUrl: endpointUrl,
        server: options.server,
        serverCertificate: options.serverCertificateChain,
        securityMode: options.securityMode,
        securityPolicyUri: securityPolicyUri,
        userIdentityTokens: userIdentityTokens,
        transportProfileUri: default_transportProfileUri,
        securityLevel: options.securityLevel
    });

    endpoint.restricted = options.restricted;

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
    const endpoint_securityPolicy = fromURI(endpoint.securityPolicyUri);
    return (endpoint.securityMode === securityMode && endpoint_securityPolicy === securityPolicy);
}

/**
 * @method getEndpointDescription
 * @param securityMode
 * @param securityPolicy
 * @return endpoint_description {EndpointDescription|null}
 */
OPCUAServerEndPoint.prototype.getEndpointDescription = function (securityMode, securityPolicy) {

    const self = this;
    const endpoints = self.endpointDescriptions();
    const arr = _.filter(endpoints, matching_endpoint.bind(this, securityMode, securityPolicy));
    assert(arr.length === 0 || arr.length === 1);
    return arr.length === 0 ? null : arr[0];
};


OPCUAServerEndPoint.prototype.addEndpointDescription = function (securityMode, securityPolicy, options) {

    const self = this;

    options = options || {};
    options.allowAnonymous = (options.allowAnonymous === undefined) ? true : options.allowAnonymous;


    //xx if (securityPolicy !== SecurityPolicy.None) {
    //xx }
    if (securityMode === MessageSecurityMode.None && securityPolicy !== SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    if (securityMode !== MessageSecurityMode.None && securityPolicy === SecurityPolicy.None) {
        throw new Error(" invalid security ");
    }
    //
    const endpoint_desc = self.getEndpointDescription(securityMode, securityPolicy);
    if (endpoint_desc) {
        throw new Error(" endpoint already exist");
    }
    const port = self.port;

    options.hostname = options.hostname || get_fully_qualified_domain_name();

    self._endpoints.push(_makeEndpointDescription({
        port: port,
        server: self.serverInfo,
        serverCertificateChain: self.getCertificateChain(),
        securityMode: securityMode,
        securityPolicy: securityPolicy,
        allowAnonymous: options.allowAnonymous,
        resourcePath: options.resourcePath,
        hostname: options.hostname,
        restricted: !!options.restricted
    }));
};

OPCUAServerEndPoint.prototype.addRestrictedEndpointDescription = function (options) {
    const self = this;
    options = _.clone(options);
    options.restricted = true;
    return self.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
};

const defaultSecurityModes = [
    MessageSecurityMode.None,
    MessageSecurityMode.Sign,
    MessageSecurityMode.SignAndEncrypt
];
const defaultSecurityPolicies = [
    SecurityPolicy.Basic128Rsa15,
    SecurityPolicy.Basic256,
//xx UNUSED!!    SecurityPolicy.Basic256Rsa15,
    SecurityPolicy.Basic256Sha256
];

OPCUAServerEndPoint.prototype.addStandardEndpointDescriptions = function (options) {

    const self = this;

    options = options || {};

    options.securityModes = options.securityModes || defaultSecurityModes;
    options.securityPolicies = options.securityPolicies || defaultSecurityPolicies;

    if (options.securityModes.indexOf(MessageSecurityMode.None) >= 0) {
        self.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
    } else {
        if (!options.disableDiscovery) {
            self.addRestrictedEndpointDescription(options);
        }
    }


        for (let i = 0; i < options.securityModes.length; i++) {
            const securityMode = options.securityModes[i];
            if (securityMode === MessageSecurityMode.None) {
                continue;
            }

            for (let j = 0; j < options.securityPolicies.length; j++) {
                const securityPolicy = options.securityPolicies[j];
                if (securityPolicy === SecurityPolicy.None) {
                    continue;
                }
                self.addEndpointDescription(securityMode, securityPolicy, options);
            }
        }
};

/**
 * returns the list of end point descriptions.
 * @method endpointDescriptions
 * @return {Array}
 */
OPCUAServerEndPoint.prototype.endpointDescriptions = function () {
    const self = this;
    return self._endpoints;
};


OPCUAServerEndPoint.prototype._preregisterChannel = function(channel)
{
    // _preregisterChannel is used to keep track of channel for which
    // that are in early stage of the hand shaking process.
    // e.g HEL/ACK and OpenSecureChannel may not have been received yet
    // as they will need to be interrupted when OPCUAServerEndPoint is closed
    const self = this;
    assert(self._started,"OPCUAServerEndPoint must be started");

    assert(!self._channels.hasOwnProperty(channel.hashKey)," channel already preregistered!");

    self._channels[channel.hashKey] = channel;

    channel._unpreregisterChannelEvent =function () {
        debugLog("Channel received an abort event during the preregistration phase");
        self._unpreregisterChannel(channel);
        channel.dispose();
    };
    channel.on("abort",channel._unpreregisterChannelEvent);
};
OPCUAServerEndPoint.prototype._unpreregisterChannel = function(channel) {
    const self = this;

    if (!self._channels[channel.hashKey]) {
        debugLog("Already un preregistered ?",channel.hashKey);
        return;
    }

    delete self._channels[channel.hashKey];
    assert(_.isFunction(channel._unpreregisterChannelEvent));
    channel.removeListener("abort",channel._unpreregisterChannelEvent);
    channel._unpreregisterChannelEvent = null;
};


/**
 * @method _registerChannel
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._registerChannel = function (channel) {

    const self = this;

    if (self._started) {

        debugLog("_registerChannel = ".red, "channel.hashKey = ", channel.hashKey);

        assert(!self._channels[channel.hashKey]);
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
        channel.dispose();
    }
};

/**
 * @method _unregisterChannel
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._unregisterChannel = function (channel) {

    const self = this;
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

    ///channel.dispose();
};

OPCUAServerEndPoint.prototype._end_listen = function (err) {

    const self = this;
    assert(_.isFunction(self._listen_callback));
    self._listen_callback(err);
    self._listen_callback = null;
};

/**
 * @method listen
 * @async
 */
OPCUAServerEndPoint.prototype.listen = function (callback) {

    const self = this;
    assert(_.isFunction(callback));
    assert(!self._started, "OPCUAServerEndPoint is already listening");

    self._listen_callback = callback;

    self._server.on("error", function (err) {
        debugLog(" error".red.bold + " port = " + self.port, err);
        self._started = false;
        self._end_listen(err);
    });
    self._server.on("listening",function() {
        debugLog("server is listening");
    });
    self._server.listen(self.port, /*"::",*/ function (err) { //'listening' listener
        debugLog("LISTENING TO PORT ".green.bold, self.port, "err  ", err);
        assert(!err, " cannot listen to port ");
        self._started = true;
        self._end_listen();
    });
};

OPCUAServerEndPoint.prototype.killClientSockets = function (callback) {

    const self = this;
    const chnls = _.values(self._channels);
    chnls.forEach(function(channel){
        if (channel.transport && channel.transport._socket) {
            channel.transport._socket.close();
            channel.transport._socket.destroy();
            channel.transport._socket.emit("error", new Error("EPIPE"));
        }
    });
    callback();
};

OPCUAServerEndPoint.prototype.suspendConnection = function (callback) {

    const self = this;
    assert(self._started);
    self._server.close(function () {
//xx        assert(self._started);
        self._started = false;
    });
    self._started = false;
    callback();
};

OPCUAServerEndPoint.prototype.restoreConnection = function (callback) {
    const self = this;
    self.listen(callback);
};

/**
 * @method shutdown_channel
 * @param channel
 * @param inner_callback
 */
function shutdown_channel(channel, inner_callback) {

    const self = this;

    assert(_.isFunction(inner_callback));
    channel.once("close", function () {
        //xx console.log(" ON CLOSED !!!!");
     });

    channel.close(function () {
        self._unregisterChannel(channel);
        setImmediate(inner_callback);
    });
}

/**
 * @method shutdown
 * @async
 * @param callback {Function}
 */
OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    const self = this;

    debugLog("OPCUAServerEndPoint#shutdown ");

    if (self._started) {
        // make sure we don't accept new connection any more ...
        self.suspendConnection(function () {
            // shutdown all opened channels ...
            const _channels = _.values(self._channels);
            async.each(_channels, shutdown_channel.bind(self), function (err) {
                if ( !(Object.keys(self._channels).length === 0)) {
                    console.log(" Bad !")
                }
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
    const chnls = _.values(this._channels);
    return this.bytesWrittenInOldChannels + chnls.reduce(
      function (accumulated, channel) {
          return accumulated + channel.bytesWritten;
      }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("bytesRead", function () {
    const chnls = _.values(this._channels);
    return this.bytesReadInOldChannels + chnls.reduce(
      function (accumulated, channel) {
          return accumulated + channel.bytesRead;
      }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("transactionsCount", function () {
    const chnls = _.values(this._channels);
    return this.transactionsCountOldChannels + chnls.reduce(
      function (accumulated, channel) {
          return accumulated + channel.transactionsCount;
      }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("securityTokenCount", function () {
    const chnls = _.values(this._channels);
    return this.securityTokenCountOldChannels + chnls.reduce(
      function (accumulated, channel) {
          return accumulated + channel.securityTokenCount;
      }, 0);
});

OPCUAServerEndPoint.prototype.__defineGetter__("activeChannelCount", function () {
    const self = this;
    return Object.keys(self._channels).length;
});

exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
