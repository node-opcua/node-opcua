"use strict";
/**
 * @module opcua.client
 */

const util = require("util");
const EventEmitter = require("events").EventEmitter;
const fs = require("fs");
const path = require("path");
const async = require("async");
const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const once = require("once");
const delayed = require("delayed");


const endpoints_service = require("node-opcua-service-endpoints");

const GetEndpointsRequest = endpoints_service.GetEndpointsRequest;
const GetEndpointsResponse = endpoints_service.GetEndpointsResponse;
const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
const toURI = require("node-opcua-secure-channel").toURI;
const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const OPCUASecureObject = require("node-opcua-common").OPCUASecureObject;

const ClientSecureChannelLayer = require("node-opcua-secure-channel/src/client/client_secure_channel_layer").ClientSecureChannelLayer;
const ClientSession = require("./client_session").ClientSession;


const defaultConnectionStrategy = {
    maxRetry: 100,
    initialDelay: 1000,
    maxDelay: 20000,
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
 * @param [options.tokenRenewalInterval =0] {Number} if not specify or set to 0 , token  renewal will happen around 75% of the defaultSecureTokenLiveTime
 * @param [options.keepPendingSessionsOnDisconnect=false] if set to true, pending session will not be automatically closed *
 *                                                  when disconnect is called
 * @constructor
 */
function OPCUAClientBase(options) {


    options = options || {};

    EventEmitter.call(this);

    options.certificateFile = options.certificateFile || path.join(__dirname, "../certificates/client_selfsigned_cert_1024.pem");

    options.privateKeyFile = options.privateKeyFile || path.join(__dirname, "../certificates/PKI/own/private/private_key.pem");

    // istanbul ignore next
    if (!fs.existsSync(options.certificateFile)) {
        throw new Error(" cannot locate certificate file " + options.certificateFile);
    }

    // istanbul ignore next
    if (!fs.existsSync(options.privateKeyFile)) {
        throw new Error(" cannot locate private key file " + options.privateKeyFile);
    }

    OPCUASecureObject.call(this, options);

    // must be ZERO with Spec 1.0.2
    this.protocolVersion = 0;

    this._sessions = [];


    this._server_endpoints = [];
    this._secureChannel = null;

    this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;
    this.tokenRenewalInterval = options.tokenRenewalInterval || 0;
    assert(_.isFinite(this.tokenRenewalInterval) && this.tokenRenewalInterval >= 0);
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
    this.securityPolicy = options.securityPolicy || toURI("None");
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
    this._byteRead = 0;
    this._byteWritten = 0;
    this._transactionsPerformed = 0;
    this._timedOutRequestCount = 0;

    /**
     * @property connectionStrategy
     * @type {options.connectionStrategy|{maxRetry, initialDelay, maxDelay, randomisationFactor}|*|{maxRetry: number, initialDelay: number, maxDelay: number, randomisationFactor: number}}
     */
    this.connectionStrategy = options.connectionStrategy || defaultConnectionStrategy;

    /***
     * @property keepPendingSessionsOnDisconnect²
     * @type {boolean}
     */
    this.keepPendingSessionsOnDisconnect = options.keepPendingSessionsOnDisconnect || false;
}

util.inherits(OPCUAClientBase, EventEmitter);

OPCUAClientBase.prototype.getPrivateKey = OPCUASecureObject.prototype.getPrivateKey;
OPCUAClientBase.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;
OPCUAClientBase.prototype.getCertificateChain = OPCUASecureObject.prototype.getCertificateChain;

const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
OPCUAClientBase.registry = new ObjectRegistry();

/**
 * is true when the client has already requested the server end points.
 * @property knowsServerEndpoint
 * @type boolean
 */
OPCUAClientBase.prototype.__defineGetter__("knowsServerEndpoint", function () {
    const self = this;
    return (self._server_endpoints && self._server_endpoints.length > 0);
});

OPCUAClientBase.prototype._destroy_secure_channel = function () {


    const self = this;
    if (self._secureChannel) {


        if (doDebug) {
            debugLog(" DESTROYING SECURE CHANNEL ", self._secureChannel.isTransactionInProgress());
        }
        // keep accumulated statistics
        self._byteWritten += self._secureChannel.bytesWritten;
        self._byteRead += self._secureChannel.bytesRead;
        self._transactionsPerformed += self._secureChannel.transactionsPerformed;
        self._timedOutRequestCount += self._secureChannel.timedOutRequestCount;


        self._secureChannel.dispose();

        self._secureChannel.removeAllListeners();
        self._secureChannel = null;

        if (doDebug) {
            debugLog("byteWritten  = ",self._byteWritten );
            debugLog("byteRead     = ",self._byteRead);
        }
    }
};


function __findEndpoint(endpointUrl, params, callback) {

    const securityMode = params.securityMode;
    const securityPolicy = params.securityPolicy;

    const options = {
        connectionStrategy: params.connectionStrategy,
        endpoint_must_exist: false
    };

    const client = new OPCUAClientBase(options);

    let selected_endpoint = null;
    const all_endpoints = null;
    const tasks = [
        function (callback) {
            client.on("backoff", function () {
                console.log("finding Enpoint => reconnecting ");
            });
            client.connect(endpointUrl, function (err) {
                if (err) {
                    console.log("Fail to connect to server ", endpointUrl, " to collect certificate server");
                }
                return callback(err);
            });
        },
        function (callback) {
            client.getEndpointsRequest(function (err, endpoints) {

                if (!err) {
                    endpoints.forEach(function (endpoint, i) {
                        if (endpoint.securityMode === securityMode && endpoint.securityPolicyUri === securityPolicy.value) {
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

    async.series(tasks, function (err) {

        if (err) {
            return callback(err);
        }

        if (!selected_endpoint) {
            callback(new Error(" Cannot find an Endpoint matching " +
                " security mode: " + securityMode.toString() +
                " policy: " + securityPolicy.toString()));
        }

        const result = {
            selectedEndpoint: selected_endpoint,
            endpoints: all_endpoints
        };
        callback(null, result);
    });
}


/**
 * @property isReconnecting
 * @type {Boolean} true if the client is trying to reconnect to the server after a connection break.
 */
OPCUAClientBase.prototype.__defineGetter__("isReconnecting", function () {

    const self = this;
    return !!(self._secureChannel && self._secureChannel.isConnecting);
});

OPCUAClientBase.prototype._cancel_reconnection = function (callback) {

    const self = this;

    // istanbul ignore next
    if (!self._secureChannel) {
        return callback(null); // nothing to do
    }
    self._secureChannel.abortConnection(function (err) {
        self._secureChannel = null;
        callback();
    });
};

OPCUAClientBase.prototype._recreate_secure_channel = function (callback) {

    debugLog("_recreate_secure_channel...");

    const self = this;
    assert(_.isFunction(callback));

    if (!self.knowsServerEndpoint) {
        console.log("Cannot reconnect , server endpoint is unknown");
        return callback(new Error("Cannot reconnect, server endpoint is unknown"));
    }
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
                assert(self._secureChannel, "expecting a secureChannel here ");
                // a new channel has be created and a new connection is established
                debugLog("OPCUAClientBase:  RECONNECTED                                       !!!".bgWhite.red)
            }

            callback(err);

            /**
             * notify the observers that the reconnection process has been completed
             * @event after_reconnection
             * @param err
             */
            self.emit("after_reconnection", err); // send after callback

        });
    });
};

function _verify_serverCertificate(serverCertificate, callback) {
    // check if certificate is trusted or untrusted
    const crypto_utils = require("node-opcua-crypto").crypto_utils;

    const pki_folder = process.cwd() + "/pki";

    // istanbul ignore next
    if (!fs.existsSync(pki_folder)) {
        fs.mkdirSync(pki_folder);
    }
    const pki_untrusted_folder = path.join(pki_folder, "untrusted");

    // istanbul ignore next
    if (!fs.existsSync(pki_untrusted_folder)) {
        fs.mkdirSync(pki_untrusted_folder);
    }
    const thumbprint = crypto_utils.makeSHA1Thumbprint(serverCertificate);

    const certificate_filename = path.join(pki_untrusted_folder, thumbprint.toString("hex") + ".pem");
    fs.writeFile(certificate_filename, crypto_utils.toPem(serverCertificate, "CERTIFICATE"), function () {
        setImmediate(callback);
    });

}


OPCUAClientBase.prototype._internal_create_secure_channel = function (callback) {

    const self = this;
    let secureChannel;
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
                connectionStrategy: self.connectionStrategy,
                tokenRenewalInterval: self.tokenRenewalInterval,
            });

            self._secureChannel = secureChannel;

            secureChannel.protocolVersion = self.protocolVersion;

            secureChannel.create(self.endpointUrl, function (err) {
                if (err) {
                    debugLog("Cannot create secureChannel".yellow, (err.message ? err.message.cyan : ""));
                    self._destroy_secure_channel();
                } else {
                    assert(self._secureChannel !== null);
                    _install_secure_channel_event_handlers(self, secureChannel);
                }
                assert(err || self._secureChannel !== null);
                _inner_callback(err);
            });

            secureChannel.on("backoff", function (number, delay) {
                self.emit("backoff", number, delay);
            });

            secureChannel.on("abort", function () {
                self.emit("abort");
            });


        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function (_inner_callback) {

            if (!self.knowsServerEndpoint) {
                assert(self._secureChannel !== null);
                self.getEndpointsRequest(function (err/*, endpoints*/) {
                    assert(self._secureChannel !== null);
                    _inner_callback(err);
                });
            } else {
                // end points are already known
                assert(self._secureChannel !== null);
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
            assert(self._secureChannel !== null);
            callback(err, secureChannel);
        }
    });

};

/**
 * true if the connection strategy is set to automatically try to reconnect in case of failure
 * @property reconnectOnFailure
 * @type {Boolean}
 */
OPCUAClientBase.prototype.__defineGetter__("reconnectOnFailure", function () {
    const self = this;
    return self.connectionStrategy.maxRetry > 0;
});


function _install_secure_channel_event_handlers(self, secureChannel) {

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
        debugLog("SecureChannel Security Token ", token.tokenId, " is about to expired , it's time to request a new token");
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


            setImmediate(function () {

                self._recreate_secure_channel(function (err) {

                    debugLog("secureChannel#on(close) => _recreate_secure_channel returns ", err ? err.message : "OK");
                    if (err) {
                        //xx assert(!self._secureChannel);
                        self.emit("close", err);
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
                                    debugLog("connection_reestablished has failed");
                                    self.disconnect(function () {
                                        //xx callback(err);
                                    });
                                }
                            });
                        }
                    }
                });
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
 * @param endpointUrl {string}
 * @param callback {Function}
 */
OPCUAClientBase.prototype.connect = function (endpointUrl, callback) {

    assert(_.isFunction(callback), "expecting a callback");
    const self = this;

    self.endpointUrl = endpointUrl;

    // prevent illegal call to connect
    if (self._secureChannel !== null) {
        setImmediate(function () {
            callback(new Error("connect already called"), null);
        });
        return;
    }

    if (!self.serverCertificate && self.securityMode !== MessageSecurityMode.NONE) {

        debugLog("OPCUAClient : getting serverCertificate");
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
        const params = {
            securityMode: this.securityMode,
            securityPolicy: this.securityPolicy,
            connectionStrategy: this.connectionStrategy,
            endpoint_must_exist: false
        };
        return __findEndpoint(endpointUrl,params, function (err, result) {
            if (err) {
                return callback(err);
            }

            const endpoint = result.selectedEndpoint;
            if (!endpoint) {
                // no matching end point can be found ...
                return callback(new Error("cannot find endpoint"));
            }
            assert(endpoint);
            _verify_serverCertificate(endpoint.serverCertificate, function (err) {
                if (err) {
                    return callback(err);
                }
                self.serverCertificate = endpoint.serverCertificate;
                return self.connect(endpointUrl, callback);
            });
        });
    }

    //todo: make sure endpointUrl exists in the list of endpoints send by the server
    // [...]

    // make sure callback will only be call once regardless of outcome, and will be also deferred.
    const callback_od = once(delayed.deferred(callback));
    callback = null;

    OPCUAClientBase.registry.register(self);

    self._internal_create_secure_channel(function (err, secureChannel) {
        callback_od(err);
    });

};

OPCUAClientBase.prototype.getClientNonce = function () {
    return this._secureChannel.clientNonce;
};

OPCUAClientBase.prototype.performMessageTransaction = function (request, callback) {

    const self = this;
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

    const self = this;

    if (!callback) {
        callback = options;
        options = {};
    }
    assert(_.isFunction(callback));

    options.endpointUrl = options.endpointUrl || self.endpointUrl;
    options.localeIds = options.localeIds || [];
    options.profileUris = options.profileUris || [];

    const request = new GetEndpointsRequest({
        endpointUrl: options.endpointUrl,
        localeIds: options.localeIds,
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

const register_server_service = require("node-opcua-service-register-server");
const FindServersRequest = register_server_service.FindServersRequest;
const FindServersResponse = register_server_service.FindServersResponse;

/**
 * @method findServers
 * @param options
 * @param [options.endpointUrl]
 * @param [options.localeIds] Array
 * @param [options.serverUris] Array
 * @param callback
 */
OPCUAClientBase.prototype.findServers = function (options, callback) {

    const self = this;

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

    const request = new FindServersRequest({
        endpointUrl: options.endpointUrl || this.endpointUrl,
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
    const self = this;

    const sessions = _.clone(self._sessions);
    async.map(sessions, function (session, next) {
        assert(session instanceof ClientSession);
        assert(session._client === self);
        session.close(function (err) {
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
        if (self._sessions.length > 0) {
            debugLog(self._sessions.map(function (s) {
                return s.authenticationToken.toString()
            }).join(" "));
        }

        assert(self._sessions.length === 0, " failed to disconnect exiting sessions ");
        callback(err);
    });

};

OPCUAClientBase.prototype._addSession = function (session) {
    const self = this;
    assert(!session._client || session._client === self);
    assert(!_.contains(self._sessions, session), "session already added");
    session._client = self;
    self._sessions.push(session);

    if (self.keepSessionAlive) {
        session.startKeepAliveManager();
    }

};

OPCUAClientBase.prototype._removeSession = function (session) {
    const self = this;
    const index = self._sessions.indexOf(session);
    if (index >= 0) {
        const s = self._sessions.splice(index, 1)[0];
        assert(s === session);
        assert(!_.contains(self._sessions, session));
        assert(session._client === self)
        session._client = null;
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

    assert(_.isFunction(callback), "expecting a callback function here");

    const self = this;
    if (self.isReconnecting) {
        debugLog("OPCUAClientBase#disconnect called while reconnection is in progress");
        // let's abort the reconnection process
        return self._cancel_reconnection(function (err) {
            assert(!err, " why would this fail ?");
            assert(!self.isReconnecting);
            // sessions cannot be cancelled properly and must be discarded.
            self.disconnect(callback);
        });
    }

    if (self._sessions.length && !self.keepPendingSessionsOnDisconnect) {
        debugLog("warning : disconnection : closing pending sessions");
        // disconnect has been called whereas living session exists
        // we need to close them first ....
        self._close_pending_sessions(function (/*err*/) {
            self.disconnect(callback);
        });
        return;
    }

    if (self._sessions.length ) {
        // transfer active session to  orphan and detach them from channel
        _.forEach(self._sessions,function(session) {
            self._removeSession(session)
        });
        self._sessions = [];
    }
    assert(self._sessions.length === 0, " attempt to disconnect a client with live sessions ");

    OPCUAClientBase.registry.unregister(self);

    if (self._secureChannel) {

        const tmp_channel = self._secureChannel;

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
    const self = this;
    return self._byteRead + (self._secureChannel ? self._secureChannel.bytesRead : 0);
});

/**
 * total number of bytes written by the client
 * @property bytesWritten
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("bytesWritten", function () {
    const self = this;
    return self._byteWritten + (self._secureChannel ? self._secureChannel.bytesWritten : 0);
});

/**
 * total number of transactions performed by the client
 * @property transactionsPerformed
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("transactionsPerformed", function () {
    const self = this;
    return self._transactionsPerformed + (self._secureChannel ? self._secureChannel.transactionsPerformed : 0);
});

OPCUAClientBase.prototype.__defineGetter__("timedOutRequestCount", function () {
    const self = this;
    return self._timedOutRequestCount + (self._secureChannel ? self._secureChannel.timedOutRequestCount : 0);
});

// override me !
OPCUAClientBase.prototype._on_connection_reestablished = function (callback) {
    callback();
};


OPCUAClientBase.prototype.toString = function () {

    console.log("  defaultSecureTokenLifetime.... ", this.defaultSecureTokenLifetime);
    console.log("  securityMode.................. ", this.securityMode.toString());
    console.log("  securityPolicy................ ", this.securityPolicy.toString());
    //xx this.serverCertificate = options.serverCertificate || null;
    console.log("  keepSessionAlive.............. ", this.keepSessionAlive);
    console.log("  bytesRead..................... ", this.bytesRead);
    console.log("  bytesWritten.................. ", this.bytesWritten);
    console.log("  transactionsPerformed......... ", this.transactionsPerformed);
    console.log("  timedOutRequestCount.......... ", this.timedOutRequestCount);
    console.log("  connectionStrategy.");
    console.log("        .maxRetry............... ", this.connectionStrategy.maxRetry);
    console.log("        .initialDelay........... ", this.connectionStrategy.initialDelay);
    console.log("        .maxDelay............... ", this.connectionStrategy.maxDelay);
    console.log("        .randomisationFactor.... ", this.connectionStrategy.randomisationFactor);
    console.log("  keepSessionAlive.............. ", this.keepSessionAlive);
};

exports.OPCUAClientBase = OPCUAClientBase;
