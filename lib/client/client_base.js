"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var fs = require("fs");
var path = require("path");
var async = require("async");
var _ = require("underscore");
var assert = require("better-assert");
var once = require("once");
var delayed = require("delayed");

var ClientSecureChannelLayer = require("lib/client/client_secure_channel_layer").ClientSecureChannelLayer;

var endpoints_service = require("lib/services/get_endpoints_service");

var GetEndpointsRequest = endpoints_service.GetEndpointsRequest;
var GetEndpointsResponse = endpoints_service.GetEndpointsResponse;
var MessageSecurityMode = endpoints_service.MessageSecurityMode;

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);
var OPCUASecureObject = require("lib/misc/opcua_secure_object").OPCUASecureObject;
var factories = require("lib/misc/factories");
var constructFilename = require("lib/misc/utils").constructFilename;

var defaultConnectionStrategy = {
    maxRetry:     100,
    initialDelay: 1000,
    maxDelay:     20000,
    randomisationFactor: 0.1
};

/**
 * @class OPCUAClientBase
 * @extends EventEmitter
 * @param options
 * @param options.defaultSecureTokenLiveTime {Number} default secure token lifetime in ms
 * @param [options.securityMode=MessageSecurityMode.None] {MessageSecurityMode} the default security mode.
 * @param [options.securityPolicy =SecurityPolicy.NONE] {SecurityPolicy} the security mode.
 * @param [options.serverCertificate=null] {Certificate} the server certificate.
 * @param [options.certificateFile="certificates/client_selfsigned_cert_1024.pem"] {String} client certificate pem file.
 * @param [options.privateKeyFile="certificates/client_key_1024.pem"] {String} client private key pem file.
 * @param [options.connectionStrategy] {Object}
 * @param [options.keepSessionAlive=false]{Boolean}
 * @constructor
 */
function OPCUAClientBase(options) {

    options = options || {};

    EventEmitter.call(this);

    var default_certificate_file = constructFilename("certificates/client_selfsigned_cert_1024.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    var default_private_key_file = constructFilename("certificates/client_key_1024.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    // istanbul ignore next
    if(!fs.existsSync(options.certificateFile)) {
        throw new Error(" cannot locate certificate file "+options.certificateFile );
    }

    // istanbul ignore next
    if(!fs.existsSync(options.privateKeyFile)) {
        throw new Error(" cannot locate private key file "+options.privateKeyFile );
    }

    OPCUASecureObject.call(this, options);

    // must be ZERO with Spec 1.0.2
    this.protocolVersion = 0;

    this._sessions = [];


    this._server_endpoints = [];
    this._secureChannel = null;

    this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;

    /**
     * @property securityMode
     * @type MessageSecurityMode
     */
    this.securityMode = options.securityMode || MessageSecurityMode.NONE;
    this.securityMode = MessageSecurityMode.get(this.securityMode);

    /**
     * @property securityPolicy
     * @type {SecurityPolicy}
     */
    this.securityPolicy = options.securityPolicy || securityPolicy_m.toURI("None");
    this.securityPolicy = SecurityPolicy.get(this.securityPolicy);

    /**
     * @property serverCertificate
     * @type {Certificate}
     */
    this.serverCertificate = options.serverCertificate || null;

    /**
     * true if session shall periodically probe the server to keep the session alive and prevent timeout
     * @property keepSessionAlive
     * @type {boolean}
     */
    this.keepSessionAlive = _.isBoolean(options.keepSessionAlive) ? options.keepSessionAlive : false;
    
    // statistics...
    this._byteRead    = 0;
    this._byteWritten = 0;
    this._transactionsPerformed = 0;
    this._timedOutRequestCount = 0;

    // this.objectFactory = {
    //     constructObject: function (id) {
    //         return factories.constructObject(id);
    //     }
    // };
    /**
     * @property connectionStrategy
     * @type {options.connectionStrategy|{maxRetry, initialDelay, maxDelay, randomisationFactor}|*|{maxRetry: number, initialDelay: number, maxDelay: number, randomisationFactor: number}}
     */
    this.connectionStrategy= options.connectionStrategy || defaultConnectionStrategy;
}
util.inherits(OPCUAClientBase, EventEmitter);

OPCUAClientBase.prototype.getPrivateKey = OPCUASecureObject.prototype.getPrivateKey;
OPCUAClientBase.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;
OPCUAClientBase.prototype.getCertificateChain = OPCUASecureObject.prototype.getCertificateChain;


/**
 * is true when the client has already requested the server end points.
 * @property knowsServerEndpoint
 * @type boolean
 */
OPCUAClientBase.prototype.__defineGetter__("knowsServerEndpoint",function() {
    var self = this;
    return (self._server_endpoints && self._server_endpoints.length >0);
});

OPCUAClientBase.prototype._destroy_secure_channel = function () {

    var self = this;
    if (self._secureChannel) {
        debugLog(" DESTROYING SECURE CHANNEL ");

        // keep accumulated statistics
        self._byteWritten += self._secureChannel.bytesWritten;
        self._byteRead    += self._secureChannel.bytesRead;
        self._transactionsPerformed += self._secureChannel.transactionsPerformed;
        self._timedOutRequestCount += self._secureChannel.timedOutRequestCount;

        self._secureChannel.removeAllListeners();
        self._secureChannel = null;
    }
};


function __findEndpoint(endpointUrl,securityMode,securityPolicy,callback) {

    var client = new OPCUAClientBase();

    var selected_endpoint = null;
    var all_endpoints = null;
    var tasks = [
        function(callback) {
            client.connect(endpointUrl, callback);
        },
        function (callback) {
            client.getEndpointsRequest(function (err, endpoints) {

                if (!err) {
                    endpoints.forEach(function (endpoint, i) {
                        if (endpoint.securityMode === securityMode && endpoint.securityPolicyUri == securityPolicy.value){
                            selected_endpoint = endpoint; // found it
                        }
                    });
                }
                callback(err);
            });
        },
        function (callback) {
            client.disconnect(callback);
        }
    ];

    async.series(tasks,function(err){
       if(err) { return callback(err); }
        if (!selected_endpoint) {
            callback (new Error(" Cannot find an Endpoint matching " +
                " security mode: "+securityMode.toString() +
                " policy: " + securityPolicy.toString()));
        }
        callback(null,selected_endpoint,all_endpoints);
    });
}


/**
 * @property isReconnecting
 * @type {Boolean} true if the client is trying to reconnect to the server after a connection break.
 */
OPCUAClientBase.prototype.__defineGetter__("isReconnecting",function() {

    var self = this;
    return !!(self._secureChannel && self._secureChannel.isConnecting);
});

OPCUAClientBase.prototype._cancel_reconnection = function(callback) {

    var self = this;

    // istanbul ignore next
    if (!self._secureChannel) {
        return callback(null); // nothing to do
    }
    self._secureChannel.abortConnection(function(err){
        self._secureChannel = null;
        callback();
    });
};

OPCUAClientBase.prototype._recreate_secure_channel = function(callback) {

    debugLog("_recreate_secure_channel...");

    var self =this;
    assert(_.isFunction(callback));
    assert(self.knowsServerEndpoint);

    assert(!self.isReconnecting);

    /**
     * notifies the observer that the OPCUA is now trying to reestablish the connection
     * after having received a connection break...
     * @event start_reconnection
     *
     */
    self.emit("start_reconnection"); // send after callback

    // create a secure channel
    // a new secure channel must be established
    setImmediate(function () {

        self._destroy_secure_channel();

        assert(!self._secureChannel);

        self._internal_create_secure_channel(function (err) {


            if (err) {
                debugLog("OPCUAClientBase: cannot reconnect ..".bgWhite.red);
            } else {
                assert(self._secureChannel);
                // a new channel has be created and a new connection is established
                debugLog("OPCUAClientBase:  RECONNECTED                                       !!!".bgWhite.red)
            }

            callback(err);

            /**
             * notify the observers that the reconnection process has been completed
             * @event after_reconnection
             * @param err
             */
            self.emit("after_reconnection",err); // send after callback

        });
    });
};

function _verify_serverCertificate(serverCertificate,callback){
    // check if certificate is trusted or untrusted
    var crypto_utils = require("lib/misc/crypto_utils");

    var pki_folder = process.cwd()+"/pki";

    // istanbul ignore next
    if (!fs.existsSync(pki_folder)){
        fs.mkdirSync(pki_folder);
    }
    var pki_untrusted_folder = path.join(pki_folder,"untrusted");

    // istanbul ignore next
    if (!fs.existsSync(pki_untrusted_folder)){
        fs.mkdirSync(pki_untrusted_folder);
    }
    var thumbprint = crypto_utils.makeSHA1Thumbprint(serverCertificate);

    var certificate_filename = path.join(pki_untrusted_folder,thumbprint.toString("hex") + ".pem");
    fs.writeFile(certificate_filename, crypto_utils.toPem(serverCertificate, "CERTIFICATE"));

    setImmediate(callback);
}


OPCUAClientBase.prototype._internal_create_secure_channel = function (callback) {

    var self = this;
    var secureChannel;
    assert(self._secureChannel === null);
    assert(_.isString(self.endpointUrl));

    async.series([

        //------------------------------------------------- STEP 2 : OpenSecureChannel
        function (_inner_callback) {

            secureChannel = new ClientSecureChannelLayer({
                defaultSecureTokenLifetime: self.defaultSecureTokenLifetime,
                securityMode: self.securityMode,
                securityPolicy: self.securityPolicy,
                serverCertificate: self.serverCertificate,
                parent: self,
                objectFactory: self.objectFactory,
                connectionStrategy: self.connectionStrategy
            });

            self._secureChannel = secureChannel;

            secureChannel.protocolVersion = self.protocolVersion;

            secureChannel.create(self.endpointUrl, function (err) {
                if (err) {
                    debugLog("Cannot create secureChannel".yellow,err.message.cyan);
                    self._destroy_secure_channel();
                } else {
                    _install_secure_channel_event_handlers(self,secureChannel);
                }
                _inner_callback(err);
            });

            secureChannel.on("backoff",function(number,delay) {
                self.emit("backoff",number,delay);
            });

            secureChannel.on("abort",function() {
                self.emit("abort");
            });


        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function (_inner_callback) {

            if (!self.knowsServerEndpoint) {
                assert(self._secureChannel !== null);
                self.getEndpointsRequest(function (err/*, endpoints*/) {
                    _inner_callback(err);
                });
            } else {
                // end point are already known
                _inner_callback(null);
            }
        }

    ], function (err) {

        if (err) {
            //xx self.disconnect(function () {
            //xx });
            self._secureChannel = null;
            callback(err);
        } else {
            callback(err,secureChannel);
        }

    });

};

/**
 * true if the connection strategy is set to automatically try to reconnect in case of failure
 * @property reconnectOnFailure
 * @type {Boolean}
 */
OPCUAClientBase.prototype.__defineGetter__("reconnectOnFailure", function () {
    var self = this;
    return  self.connectionStrategy.maxRetry >0;
});


function _install_secure_channel_event_handlers(self,secureChannel) {

    assert(self instanceof OPCUAClientBase);

    secureChannel.on("send_chunk", function (message_chunk) {
        /**
         * notify the observer that a message_chunk has been sent
         * @event send_chunk
         * @param message_chunk
         */
        self.emit("send_chunk", message_chunk);
    });

    secureChannel.on("receive_chunk", function (message_chunk) {
        /**
         * notify the observer that a message_chunk has been received
         * @event receive_chunk
         * @param message_chunk
         */
        self.emit("receive_chunk", message_chunk);
    });

    secureChannel.on("send_request", function (message) {
        /**
         * notify the observer that a request has been sent to the server.
         * @event send_request
         * @param message
         */
        self.emit("send_request", message);
    });

    secureChannel.on("receive_response", function (message) {
        /**
         * notify the observer that a response has been received from the server.
         * @event receive_response
         * @param message
         */
        self.emit("receive_response", message);
    });

    secureChannel.on("lifetime_75", function (token) {
        // secureChannel requests a new token
        debugLog("SecureChannel Security Token ",token.tokenId, " is about to expired , it's time to request a new token");
        // forward message to upper level
        self.emit("lifetime_75", token);
    });

    secureChannel.on("security_token_renewed", function () {
        // forward message to upper level
        self.emit("security_token_renewed");
    });

    secureChannel.on("close", function (err) {

        debugLog(" OPCUAClientBase emitting close".yellow.bold, err);

        if (!err || !self.reconnectOnFailure) {
            // this is a normal close operation initiated byu
            /**
             * @event close
             * @param error {Error}
             */
            self.emit("close", err);
            setImmediate(function () {
                self._destroy_secure_channel();
            });
            return;
        } else {


            self._recreate_secure_channel(function(err) {

                debugLog("_recreate_secure_channel returns ",err ? err.message : "OK");
                if (err) {
                    //xx assert(!self._secureChannel);
                    self.emit("close",err);
                    return;
                } else {
                    /**
                     * @event connection_reestablished
                     *        send when the connection is reestablished after a connection break
                     */
                    self.emit("connection_reestablished");

                    // now delegate to upper class the
                    if (self._on_connection_reestablished) {
                        assert(_.isFunction(self._on_connection_reestablished));
                        self._on_connection_reestablished(function (err) {

                            if (err) {
                                self.disconnect(function(){
                                    //xx callback(err);
                                });
                            }
                        })
                    }
                }
            });
        }
        //xx console.log("xxxx OPCUAClientBase emitting close".yellow.bold,err);
    });

    secureChannel.on("timed_out_request", function (request) {
        /**
         * send when a request has timed out without receiving a response
         * @event timed_out_request
         * @param request
         */
        self.emit("timed_out_request", request);
    });
//            self._secureChannel.on("end", function (err) {
//                console.log("xxx OPCUAClientBase emitting end".yellow.bold,err);
//                self.emit("close", err);
//            });
}

/**
 *
 * connect the OPC-UA client to a server end point.
 * @method connect
 * @async
 * @param endpoint_url {string}
 * @param callback {Function}
 */
OPCUAClientBase.prototype.connect = function (endpoint_url, callback) {

    assert(_.isFunction(callback), "expecting a callback");
    var self = this;

    self.endpointUrl = endpoint_url;

    // prevent illegal call to connect
    if (self._secureChannel !== null) {
        setImmediate(function () {
            callback(new Error("connect already called"), null);
        });
        return;
    }

    if (!self.serverCertificate && self.securityMode!== MessageSecurityMode.NONE) {

        // we have not been given the serverCertificate but this certificate
        // is required as the connection is to be secured.
        //
        // Let's explore the server endpoint that matches our security settings
        // This will give us the missing Certificate as well from the server itself.
        // todo :
        // Once we have the certificate, we cannot trust it straight away
        // we have to verify that the certificate is valid and not outdated and not revoked.
        // if the certificate is self-signed the certificate must appear in the trust certificate
        // list.
        // if the certificate has been certified by an Certificate Authority we have to
        // verify that the certificates in the chain are valid and not revoked.
        //
        return __findEndpoint(endpoint_url,this.securityMode,this.securityPolicy,function(err,endpoint){
            if (err) { return callback(err); }
            console.log(" Found End point ");
            _verify_serverCertificate(endpoint.serverCertificate,function(err) {
                if (err) { return callback(err); }
                self.serverCertificate = endpoint.serverCertificate;
                return self.connect(endpoint_url,callback);
            });
        });
    }

    //todo: make sure endpoint_url exists in the list of endpoints send by the server
    // [...]

    // make sure callback will only be call once regardless of outcome, and will be also deferred.
    var callback_od = once(delayed.deferred(callback)); callback = null;

    self._internal_create_secure_channel(function(err,secureChannel) {
        callback_od(err);
    });

};

OPCUAClientBase.prototype.getClientNonce = function () {
    return this._secureChannel.clientNonce;
};

OPCUAClientBase.prototype.performMessageTransaction = function (request, callback) {

    var self = this;
    if (!self._secureChannel) {
        // this may happen if the Server has closed the connection abruptly for some unknown reason
        // or if the tcp connection has been broken.
        return callback(new Error("No SecureChannel , connection may have been canceled abruptly by server"));
    }
    assert(self._secureChannel);
    assert(request);
    assert(request.requestHeader);
    assert(typeof callback === "function");
    self._secureChannel.performMessageTransaction(request, callback);
};



/**
 *
 * return the endpoint information matching  security mode and security policy.
 * @method findEndpoint
 * @return {EndPoint}
 */
OPCUAClientBase.prototype.findEndpointForSecurity = function (securityMode, securityPolicy) {
    assert(this.knowsServerEndpoint, "Server end point are not known yet");
    return _.find(this._server_endpoints, function (endpoint) {
        return endpoint.securityMode === securityMode &&
               endpoint.securityPolicyUri === securityPolicy.value;
    });
};

/**
 *
 * return the endpoint information matching the specified url , security mode and security policy.
 * @method findEndpoint
 * @return {EndPoint}
 */
OPCUAClientBase.prototype.findEndpoint = function (endpointUrl, securityMode, securityPolicy) {
    assert(this.knowsServerEndpoint, "Server end point are not known yet");
    return _.find(this._server_endpoints, function (endpoint) {
        return endpoint.endpointUrl === endpointUrl &&
            endpoint.securityMode === securityMode &&
            endpoint.securityPolicyUri === securityPolicy.value;
    });
};


/**
 * @method getEndpointsRequest
 * @async
 * @async
 *
 * @param [options]
 * @param [options.endpointUrl] {String} the network address that the Client used to access the Discovery Endpoint .
 * @param [options.localeIds} {Array<LocaleId>}  List of locales to use.
 * @param [options.profileUris} {Array<String>}  List of transport profiles that the returned Endpoints shall support.
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.serverEndpoints {Array<EndpointDescription>} the array of endpoint descriptions
 *
 */
OPCUAClientBase.prototype.getEndpointsRequest = function (options, callback) {

    var self = this;

    if (!callback) {
        callback = options;
        options = {};
    }
    assert(_.isFunction(callback));

    options.endpointUrl = options.endpointUrl || self.endpoint_url;
    options.localeIds = options.localeIds || [];
    options.profileUris = options.profileUris || [];

    var request = new GetEndpointsRequest({
        endpointUrl: options.endpointUrl,
        localeIds:   options.localeIds,
        profileUris: options.profileUris,
        requestHeader: {
            auditEntryId: null
        }
    });

    self.performMessageTransaction(request, function (err, response) {
        self._server_endpoints = null;
        if (!err) {
            assert(response instanceof GetEndpointsResponse);
            self._server_endpoints = response.endpoints;
        }
        callback(err, self._server_endpoints);
    });
};

/**
 *
 * send a FindServers request to a discovery server
 * @method findServers
 * @async
 * @param callback [Function}
 */

var register_server_service = require("lib/services/register_server_service");
var FindServersRequest = register_server_service.FindServersRequest;
var FindServersResponse = register_server_service.FindServersResponse;

/**
 * @method findServers
 * @param options
 * @param [options.endpointUrl]
 * @param [options.localeIds] Array
 * @param [options.serverUris] Array
 * @param callback
 */
OPCUAClientBase.prototype.findServers = function (options, callback) {

    var self = this;

    if (!self._secureChannel) {
        setImmediate(function () {
            callback(new Error("Invalid Secure Channel"));
        });
        return;
    }

    if (!callback) {
        callback = options;
        options = {};
    }

    var request = new FindServersRequest({
        endpointUrl: options.endpointUrl || this.endpoint_url,
        localeIds: options.localeIds || [],
        serverUris: options.serverUris || []
    });


    self.performMessageTransaction(request, function (err, response) {
        if (err) {
            return callback(err);
        }
        assert(response instanceof FindServersResponse);
        callback(null, response.servers);
    });
};


OPCUAClientBase.prototype._close_pending_sessions = function (callback) {

    assert(_.isFunction(callback));
    var self = this;

    var sessions = _.clone(self._sessions);
    async.map(sessions, function (session, next) {

        assert(session._client === self);
        session.close(function(err){
            // We should not bother if we have an error here
            // Session may fail to close , if they haven't been activate and forcefully closed by server
            // in a attempt to preserve resources in the case of a DOS attack for instance.
            if (err) {
                debugLog(" failing to close session " + session.authenticationToken.toString());
            }
            next();
        });

    }, function (err) {

        // istanbul ignore next
        if (self._sessions.length>0) {
            console.log(self._sessions.map(function(s){ return s.authenticationToken.toString()}).join(" "));
        }

        assert(self._sessions.length === 0, " failed to disconnect exiting sessions ");
        callback(err);
    });

};

OPCUAClientBase.prototype._addSession = function (session) {
    var self = this;
    assert(!session._client || session._client === self);
    assert(!_.contains(self._sessions, session), "session already added");
    session._client = self;
    self._sessions.push(session);

    if (self.keepSessionAlive) {
        session.startKeepAliveManager();
    }

};

OPCUAClientBase.prototype._removeSession = function (session) {
    var self = this;
    var index = self._sessions.indexOf(session);
    if (index >= 0) {
        self._sessions.splice(index, 1);
        assert(!_.contains(self._sessions, session));
        session.dispose();
    }
    assert(!_.contains(self._sessions, session));
};


/**
 * disconnect client from server
 * @method disconnect
 * @async
 * @param callback [Function}
 */
OPCUAClientBase.prototype.disconnect = function (callback) {

    assert(_.isFunction(callback));

    var self = this;
    if (self.isReconnecting) {
        debugLog("OPCUAClientBase#disconnect called while reconnection is in progress");
        // let's abort the reconnection process
        return self._cancel_reconnection(function(err) {
            assert(!err," why would this fail ?");
            assert(!self.isReconnecting);
            // sessions cannot be cancelled properly and must be discarded.
            self.disconnect(callback);
        });
    }
    if (self._sessions.length) {
        console.log("warning : disconnection : closing pending sessions".yellow.bold);
        // disconnect has been called whereas living session exists
        // we need to close them first ....
        self._close_pending_sessions(function (/*err*/) {
            self.disconnect(callback);
        });
        return;
    }

    assert(self._sessions.length === 0, " attempt to disconnect a client with live sessions ");

    if (self._secureChannel) {

        var tmp_channel = self._secureChannel;

        self._destroy_secure_channel();

        tmp_channel.close(function () {

            debugLog(" EMIT NORMAL CLOSE");
            /**
             * @event close
             */
            self.emit("close", null);
            setImmediate(callback);
        });
    } else {
        self.emit("close", null);
        callback();
    }
};

/**
 * total number of bytes read by the client
 * @property bytesRead
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("bytesRead", function () {
    var self = this;
    return self._byteRead + (self._secureChannel ? self._secureChannel.bytesRead : 0);
});

/**
 * total number of bytes written by the client
 * @property bytesWritten
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("bytesWritten", function () {
    var self = this;
    return self._byteWritten + (self._secureChannel ?  self._secureChannel.bytesWritten : 0 );
});

/**
 * total number of transactions performed by the client
 * @property transactionsPerformed
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("transactionsPerformed", function () {
    var self = this;
    return self._transactionsPerformed + (self._secureChannel ? self._secureChannel.transactionsPerformed : 0);
});

OPCUAClientBase.prototype.__defineGetter__("timedOutRequestCount", function () {
    var self = this;
    return self._timedOutRequestCount + (self._secureChannel ? self._secureChannel.timedOutRequestCount : 0);
});

// override me !
OPCUAClientBase.prototype._on_connection_reestablished = function(callback) {
    callback();
};


OPCUAClientBase.prototype.toString = function() {

    console.log("  defaultSecureTokenLifetime.... ",this.defaultSecureTokenLifetime);
    console.log("  securityMode.................. ",this.securityMode.toString());
    console.log("  securityPolicy................ ",this.securityPolicy.toString());
    //xx this.serverCertificate = options.serverCertificate || null;
    console.log("  keepSessionAlive.............. ",this.keepSessionAlive);
    console.log("  bytesRead..................... ",this.bytesRead);
    console.log("  bytesWritten.................. ",this.bytesWritten);
    console.log("  transactionsPerformed......... ",this.transactionsPerformed);
    console.log("  timedOutRequestCount.......... ",this.timedOutRequestCount);
    console.log("  connectionStrategy.");
    console.log("        .maxRetry............... ",this.connectionStrategy.maxRetry);
    console.log("        .initialDelay........... ",this.connectionStrategy.initialDelay);
    console.log("        .maxDelay............... ",this.connectionStrategy.maxDelay);
    console.log("        .randomisationFactor.... ",this.connectionStrategy.randomisationFactor);
    console.log("  keepSessionAlive.............. ",this.keepSessionAlive);
};

exports.OPCUAClientBase = OPCUAClientBase;
