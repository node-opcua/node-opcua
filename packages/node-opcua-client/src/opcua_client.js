"use strict";
/**
 * @module opcua.client
 */


const util = require("util");
const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const crypto = require("crypto");
const async = require("async");


const StatusCodes = require("node-opcua-status-code").StatusCodes;

const session_service = require("node-opcua-service-session");
const AnonymousIdentityToken = session_service.AnonymousIdentityToken;
const CreateSessionRequest = session_service.CreateSessionRequest;
const CreateSessionResponse = session_service.CreateSessionResponse;
const ActivateSessionRequest = session_service.ActivateSessionRequest;
const ActivateSessionResponse = session_service.ActivateSessionResponse;
const CloseSessionRequest = session_service.CloseSessionRequest;

const endpoints_service = require("node-opcua-service-endpoints");
const ApplicationDescription = endpoints_service.ApplicationDescription;
const ApplicationType = endpoints_service.ApplicationType;
const EndpointDescription = endpoints_service.EndpointDescription;
const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
const getCryptoFactory = require("node-opcua-secure-channel").getCryptoFactory;
const fromURI = require("node-opcua-secure-channel").fromURI;

const crypto_utils = require("node-opcua-crypto").crypto_utils;
const UserNameIdentityToken = session_service.UserNameIdentityToken;


const buffer_utils = require("node-opcua-buffer-utils");
const createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

const UserIdentityTokenType = require("node-opcua-service-endpoints").UserIdentityTokenType;

const ClientSession = require("./client_session").ClientSession;

const utils = require("node-opcua-utils");
const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const OPCUAClientBase = require("./client_base").OPCUAClientBase;
const isNullOrUndefined = require("node-opcua-utils").isNullOrUndefined;

function validateServerNonce(serverNonce) {
    return (serverNonce && serverNonce.length < 32) ? false : true;
}

/**
 * @class OPCUAClient
 * @extends OPCUAClientBase
 * @param options
 * @param [options.securityMode=MessageSecurityMode.None] {MessageSecurityMode} the default security mode.
 * @param [options.securityPolicy =SecurityPolicy.NONE] {SecurityPolicy} the security mode.
 * @param [options.requestedSessionTimeout= 60000]            {Number} the requested session time out in CreateSession
 * @param [options.applicationName="NodeOPCUA-Client"]        {string} the client application name
 * @param [options.endpoint_must_exist=true] {Boolean} set to false if the client should accept server endpoint mismatch
 * @param [options.keepSessionAlive=false]{Boolean}
 * @param [options.certificateFile="certificates/client_selfsigned_cert_1024.pem"] {String} client certificate pem file.
 * @param [options.privateKeyFile="certificates/client_key_1024.pem"] {String} client private key pem file.
 * @param [options.clientName=""] {String} a client name string that will be used to generate session names.
 * @constructor
 */
function OPCUAClient(options) {

    options = options || {};
    OPCUAClientBase.apply(this, arguments);

    // @property endpoint_must_exist {Boolean}
    // if set to true , create Session will only accept connection from server which endpoint_url has been reported
    // by GetEndpointsRequest.
    // By default, the client is strict.
    this.endpoint_must_exist = (isNullOrUndefined(options.endpoint_must_exist)) ? true : !!options.endpoint_must_exist;

    this.requestedSessionTimeout = options.requestedSessionTimeout || 60000; // 1 minute

    this.applicationName = options.applicationName || "NodeOPCUA-Client";

    this.clientName = options.clientName || "Session";

}

util.inherits(OPCUAClient, OPCUAClientBase);


OPCUAClient.prototype._nextSessionName = function () {
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return this.clientName + this.___sessionName_counter;
};

const makeApplicationUrn = require("node-opcua-common").makeApplicationUrn;

OPCUAClient.prototype._getApplicationUri = function () {

    // get applicationURI from certificate
    const exploreCertificate = require("node-opcua-crypto").crypto_explore_certificate.exploreCertificate;

    const certificate = this.getCertificate();
    let applicationUri;
    if (certificate) {
        const e = exploreCertificate(certificate);
        applicationUri = e.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier[0];
    } else {
        const hostname = require("node-opcua-hostname").get_fully_qualified_domain_name();
        applicationUri = makeApplicationUrn(hostname, this.applicationName);
    }
    return applicationUri;

};


OPCUAClient.prototype.__resolveEndPoint = function () {

    this.securityPolicy = this.securityPolicy || SecurityPolicy.None;

    let endpoint = this.findEndpoint(this._secureChannel.endpointUrl, this.securityMode, this.securityPolicy);
    this.endpoint = endpoint;


    // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
    //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
    //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
    //   Client  shall report the difference and may close the  SecureChannel.

    if (!this.endpoint) {
        if (this.endpoint_must_exist) {
            debugLog("OPCUAClient#endpoint_must_exist = true and endpoint with url ", this._secureChannel.endpointUrl, " cannot be found");
            return false;
        } else {
            // fallback :
            // our strategy is to take the first server_end_point that match the security settings
            // ( is this really OK ?)
            // this will permit us to access a OPCUA Server using it's IP address instead of its hostname

            endpoint = this.findEndpointForSecurity(this.securityMode, this.securityPolicy);
            if (!endpoint) {
                return false;
            }
            this.endpoint = endpoint;
        }
    }
    return true;
};

OPCUAClient.prototype._createSession = function (callback) {

    const self = this;
    assert(typeof callback === "function");
    assert(self._secureChannel);
    if (!self.__resolveEndPoint() || !self.endpoint) {
        console.log(this._server_endpoints.map(function (endpoint){
           return endpoint.endpointUrl + " " + endpoint.securityMode.toString() + " " + endpoint.securityPolicyUri;
        }));
        return callback(new Error(" End point must exist " + self._secureChannel.endpointUrl));
    }
    self.serverUri = self.endpoint.server.applicationUri;
    self.endpointUrl = self._secureChannel.endpointUrl;

    const session = new ClientSession(self);
    this.__createSession_step2(session, callback);
};

function verifyEndpointDescriptionMatches(client,responseServerEndpoints) {
    // The Server returns its EndpointDescriptions in the response. Clients use this information to
    // determine whether the list of EndpointDescriptions returned from the Discovery Endpoint matches
    // the Endpoints that the Server has. If there is a difference then the Client shall close the
    // Session and report an error.
    // The Server returns all EndpointDescriptions for the serverUri
    // specified by the Client in the request. The Client only verifies EndpointDescriptions with a
    // transportProfileUri that matches the profileUri specified in the original GetEndpoints request.
    // A Client may skip this check if the EndpointDescriptions were provided by a trusted source
    // such as the Administrator.
    //serverEndpoints:
    // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery Endpoint
    // fetch to the EndpointDescriptions.

    // ToDo

    return true;
}

OPCUAClient.prototype.__createSession_step2 = function (session, callback) {

    const self = this;

    assert(typeof callback === "function");
    assert(self._secureChannel);
    assert(self.serverUri, " must have a valid server URI");
    assert(self.endpointUrl, " must have a valid server endpointUrl");
    assert(self.endpoint);


    const applicationUri = self._getApplicationUri();

    const applicationDescription = new ApplicationDescription({
        applicationUri: applicationUri,
        productUri: "NodeOPCUA-Client",
        applicationName: {text: self.applicationName},
        applicationType: ApplicationType.CLIENT,
        gatewayServerUri: undefined,
        discoveryProfileUri: undefined,
        discoveryUrls: []
    });

    // note : do not confuse CreateSessionRequest.clientNonce with OpenSecureChannelRequest.clientNonce
    //        which are two different nonce, with different size (although they share the same name )
    self.clientNonce = crypto.randomBytes(32);

    const request = new CreateSessionRequest({
        clientDescription: applicationDescription,
        serverUri: self.serverUri,
        endpointUrl: self.endpointUrl,
        sessionName: self._nextSessionName(),
        clientNonce: self.clientNonce,
        clientCertificate: self.getCertificate(),
        requestedSessionTimeout: self.requestedSessionTimeout,
        maxResponseMessageSize: 800000
    });

    // a client Nonce must be provided if security mode is set
    assert(self._secureChannel.securityMode === MessageSecurityMode.NONE || request.clientNonce !== null);

    self.performMessageTransaction(request, function (err, response) {

        if (!err) {
            //xx console.log("xxxxx response",response.toString());
            //xx console.log("xxxxx response",response.responseHeader.serviceResult);
            if (response.responseHeader.serviceResult === StatusCodes.BadTooManySessions) {
                err = new Error("Too Many Sessions : " + response.responseHeader.serviceResult.toString());

            } else if (response.responseHeader.serviceResult === StatusCodes.Good) {

                assert(response instanceof CreateSessionResponse);

                // istanbul ignore next
                if (!validateServerNonce(request.serverNonce)) {
                    return callback(new Error("invalid server Nonce"));
                }

                // todo: verify SignedSoftwareCertificates and  response.serverSignature

                session = session || new ClientSession(self);
                session.name = request.sessionName;
                session.sessionId = response.sessionId;
                session.authenticationToken = response.authenticationToken;
                session.timeout = response.revisedSessionTimeout;
                session.serverNonce = response.serverNonce;
                session.serverCertificate = response.serverCertificate;
                session.serverSignature = response.serverSignature;

                debugLog("revised session timeout = ".yellow, session.timeout);


                if (!verifyEndpointDescriptionMatches(self,response.serverEndpoints)) {
                    console.log("Endpoint description previously retrieved with GetendpointsDescription");
                    console.log(self._server_endpoints);
                    console.log("CreateSessionResponse.serverEndpoints= ");
                    console.log(response.serverEndpoints);
                    return callback(new Error("Invalid endpoint descriptions Found" ));
                }
                //xx self._server_endpoints = response.serverEndpoints;
                session.serverEndpoints = response.serverEndpoints;

            } else {
                err = new Error("Error " + response.responseHeader.serviceResult.name + " " + response.responseHeader.serviceResult.description);
            }
        }
        if (err) {
            callback(err);
        } else {
            callback(null, session);
        }
    });

};


const computeSignature = require("node-opcua-secure-channel").computeSignature;
OPCUAClient.prototype.computeClientSignature = function (channel, serverCertificate, serverNonce) {
    const self = this;
    return computeSignature(serverCertificate, serverNonce, self.getPrivateKey(), channel.messageBuilder.securityPolicy);
};

function isAnonymous(userIdentityInfo) {
    return !userIdentityInfo || (!userIdentityInfo.userName && !userIdentityInfo.password);
}

function isUserNamePassword(userIdentityInfo) {
    const res = (userIdentityInfo.userName !== undefined) && (userIdentityInfo.password !== undefined);
    return res;
}

function findUserTokenPolicy(endpoint_description, userTokenType) {
    assert(endpoint_description instanceof EndpointDescription);
    const r = _.filter(endpoint_description.userIdentityTokens, function (userIdentity) {
        // assert(userIdentity instanceof UserTokenPolicy)
        assert(userIdentity.tokenType);
        return userIdentity.tokenType === userTokenType;
    });
    return r.length === 0 ? null : r[0];
}

function createAnonymousIdentityToken(session) {

    const endpoint_desc = session.endpoint;
    assert(endpoint_desc instanceof EndpointDescription);

    const userTokenPolicy = findUserTokenPolicy(endpoint_desc, UserIdentityTokenType.ANONYMOUS);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({policyId: userTokenPolicy.policyId});
}

function createUserNameIdentityToken(session, userName, password) {

    // assert(endpoint instanceof EndpointDescription);
    assert(userName === null || typeof userName === "string");
    assert(password === null || typeof password === "string");
    const endpoint_desc = session.endpoint;
    assert(endpoint_desc instanceof EndpointDescription);

    const userTokenPolicy = findUserTokenPolicy(endpoint_desc, UserIdentityTokenType.USERNAME);

    // istanbul ignore next
    if (!userTokenPolicy) {
        throw new Error("Cannot find USERNAME user token policy in end point description");
    }

    let securityPolicy = fromURI(userTokenPolicy.securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = session._client._secureChannel.securityPolicy;
        assert(securityPolicy);
    }

    let userIdentityToken;
    let serverCertificate = session.serverCertificate;
    // if server does not provide certificate use unencrypted password
    if (serverCertificate === null) {
        userIdentityToken = new UserNameIdentityToken({
            userName: userName,
            password: Buffer.from(password, "utf-8"),
            encryptionAlgorithm: null,
            policyId: userTokenPolicy.policyId
        });
        return userIdentityToken;
    }

    assert(serverCertificate instanceof Buffer);

    serverCertificate = crypto_utils.toPem(serverCertificate, "CERTIFICATE");
    const publicKey = crypto_utils.extractPublicKeyFromCertificateSync(serverCertificate);

    let serverNonce = session.serverNonce;
    // if serverNonce not specified by server
    if (serverNonce === null) {
        serverNonce = Buffer.alloc(0);
    }
    assert(serverNonce instanceof Buffer);

    // see Release 1.02 155 OPC Unified Architecture, Part 4
    const cryptoFactory = getCryptoFactory(securityPolicy);

    // istanbul ignore next
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy");
    }

    userIdentityToken = new UserNameIdentityToken({
        userName: userName,
        password: Buffer.from(password, "utf-8"),
        encryptionAlgorithm: cryptoFactory.asymmetricEncryptionAlgorithm,
        policyId: userTokenPolicy.policyId
    });


    // now encrypt password as requested
    const lenBuf = createFastUninitializedBuffer(4);
    lenBuf.writeUInt32LE(userIdentityToken.password.length + serverNonce.length, 0);
    const block = Buffer.concat([lenBuf, userIdentityToken.password, serverNonce]);
    userIdentityToken.password = cryptoFactory.asymmetricEncrypt(block, publicKey);

    return userIdentityToken;
}

OPCUAClient.prototype.createUserIdentityToken = function (session, userIdentityToken, callback) {
    assert(_.isFunction(callback));
    const self = this;

    if (null === self.userIdentityInfo) {
        return callback(null,null);
    }
    if (isAnonymous(self.userIdentityInfo)) {

        try {
            userIdentityToken = createAnonymousIdentityToken(session);
            return callback(null, userIdentityToken);
        }
        catch (err) {
            return callback(err);
        }

    } else if (isUserNamePassword(self.userIdentityInfo)) {

        const userName = self.userIdentityInfo.userName;
        const password = self.userIdentityInfo.password;

        try {
            userIdentityToken = createUserNameIdentityToken(session, userName, password);
            return callback(null, userIdentityToken);
        }
        catch (err) {
            //xx console.log(err.stack);
            return callback(err);
        }
    } else {
        console.log(" userIdentityToken = ", userIdentityToken);
        return callback(new Error("CLIENT: Invalid userIdentityToken"));
    }
};


// see OPCUA Part 4 - $7.35
OPCUAClient.prototype._activateSession = function (session, callback) {

    assert(typeof callback === "function");
    const self = this;

    // istanbul ignore next
    if (!self._secureChannel) {
        return callback(new Error(" No secure channel"));
    }

    const serverCertificate = session.serverCertificate;
    // If the securityPolicyUri is NONE and none of the UserTokenPolicies requires encryption,
    // the Client shall ignore the ApplicationInstanceCertificate (serverCertificate)
    assert(serverCertificate === null || serverCertificate instanceof Buffer);

    const serverNonce = session.serverNonce;
    assert(!serverNonce || serverNonce instanceof Buffer);

    // make sure session is attached to this client
    const _old_client = session._client;
    session._client = self;

    self.createUserIdentityToken(session, self.userIdentityInfo, function (err, userIdentityToken) {

        if (err) {
            session._client = _old_client;
            return callback(err);
        }

        // TODO. fill the ActivateSessionRequest
        // see 5.6.3.2 Parameters OPC Unified Architecture, Part 4 30 Release 1.02
        const request = new ActivateSessionRequest({

            // This is a signature generated with the private key associated with the
            // clientCertificate. The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm
            // specified in the SecurityPolicy for the Endpoint. The SignatureData type is defined in 7.30.

            clientSignature: self.computeClientSignature(self._secureChannel, serverCertificate, serverNonce),

            // These are the SoftwareCertificates which have been issued to the Client application. The productUri contained
            // in the SoftwareCertificates shall match the productUri in the ApplicationDescription passed by the Client in
            // the CreateSession requests. Certificates without matching productUri should be ignored.  Servers may reject
            // connections from Clients if they are not satisfied with the SoftwareCertificates provided by the Client.
            // This parameter only needs to be specified in the first ActivateSession request after CreateSession.
            // It shall always be omitted if the maxRequestMessageSize returned from the Server in the CreateSession
            // response is less than one megabyte. The SignedSoftwareCertificate type is defined in 7.31.

            clientSoftwareCertificates: [],

            // List of locale ids in priority order for localized strings. The first LocaleId in the list has the highest
            // priority. If the Server returns a localized string to the Client, the Server shall return the translation
            // with the highest priority that it can. If it does not have a translation for any of the locales identified
            // in this list, then it shall return the string value that it has and include the locale id with the string.
            // See Part 3 for more detail on locale ids. If the Client fails to specify at least one locale id, the Server
            // shall use any that it has.
            // This parameter only needs to be specified during the first call to ActivateSession during a single
            // application Session. If it is not specified the Server shall keep using the current localeIds for the Session.
            localeIds: [],

            // The credentials of the user associated with the Client application. The Server uses these credentials to
            // determine whether the Client should be allowed to activate a Session and what resources the Client has access
            // to during this Session. The UserIdentityToken is an extensible parameter type defined in 7.35.
            // The EndpointDescription specifies what UserIdentityTokens the Server shall accept.
            userIdentityToken: userIdentityToken,

            // If the Client specified a user   identity token that supports digital signatures,
            // then it shall create a signature and pass it as this parameter. Otherwise the parameter is omitted.
            // The SignatureAlgorithm depends on the identity token type.
            userTokenSignature: {
                algorithm: null,
                signature: null
            }

        });

        session.performMessageTransaction(request, function (err, response) {

            if (!err && response.responseHeader.serviceResult === StatusCodes.Good) {

                assert(response instanceof ActivateSessionResponse);

                session.serverNonce = response.serverNonce;

                if (!validateServerNonce(session.serverNonce)) {
                    return callback(new Error("Invalid server Nonce"));
                }
                return callback(null, session);

            } else {

                err = err || new Error(response.responseHeader.serviceResult.toString());
                session._client = _old_client;
                return callback(err, null);
            }
        });

    });

};

/**
 * transfer session to this client
 * @method reactivateSession
 * @param session
 * @param callback
 * @return {*}
 */
OPCUAClient.prototype.reactivateSession = function (session, callback) {

    const self = this;
    assert(typeof callback === "function");
    assert(this._secureChannel, " client must be connected first");

    // istanbul ignore next
    if (!this.__resolveEndPoint() || !this.endpoint) {
        return callback(new Error(" End point must exist " + this._secureChannel.endpointUrl));
    }

    assert(!session._client || session._client.endpointUrl === self.endpointUrl, "cannot reactivateSession on a different endpoint");
    const old_client = session._client;

    debugLog("OPCUAClient#reactivateSession");

    this._activateSession(session, function (err) {
        if (!err) {

            if (old_client !== self) {
                // remove session from old client:
                if (old_client) {
                    old_client._removeSession(session);
                    assert(!_.contains(old_client._sessions, session));
                 }

                self._addSession(session);
                assert(session._client === self);
                assert(!session.closed,"session should not vbe closed");
                assert(_.contains(self._sessions, session));
            }

        } else {

            // istanbul ignore next
            if (doDebug) {
                console.log("reactivateSession has failed !".red.bgWhite, err.message);
            }
        }
        callback(err);
    });
};
/**
 * create and activate a new session
 * @async
 * @method createSession
 *
 * @param [userIdentityInfo {Object} ] optional
 * @param [userIdentityInfo.userName {String} ]
 * @param [userIdentityInfo.password {String} ]
 *
 * @param callback {Function}
 * @param callback.err     {Error|null}   - the Error if the async method has failed
 * @param callback.session {ClientSession} - the created session object.
 *
 *
 * @example :
 *     // create a anonymous session
 *     client.createSession(function(err,session) {
 *       if (err) {} else {}
 *     });
 *
 * @example :
 *     // create a session with a userName and password
 *     client.createSession({userName: "JoeDoe", password:"secret"}, function(err,session) {
 *       if (err) {} else {}
 *     });
 *
 */
OPCUAClient.prototype.createSession = function (userIdentityInfo, callback) {

    const self = this;
    if (_.isFunction(userIdentityInfo)) {
        callback = userIdentityInfo;
        userIdentityInfo = {};
    }

    self.userIdentityInfo = userIdentityInfo;

    assert(_.isFunction(callback));

    self._createSession(function (err, session) {
        if (err) {
            callback(err);
        } else {

            self._addSession(session);

            self._activateSession(session, function (err) {
                callback(err, session);
            });
        }
    });
};


/**
 * @method changeSessionIdentity
 * @param session
 * @param userIdentityInfo
 * @param callback
 * @async
 */
OPCUAClient.prototype.changeSessionIdentity = function (session, userIdentityInfo, callback) {

    const self = this;
    assert(_.isFunction(callback));

    const old_userIdentity = self.userIdentityInfo;
    self.userIdentityInfo = userIdentityInfo;

    self._activateSession(session, function (err) {
        callback(err);
    });


};


OPCUAClient.prototype._closeSession = function (session, deleteSubscriptions, callback) {

    const self = this;
    assert(_.isFunction(callback));
    assert(_.isBoolean(deleteSubscriptions));

    // istanbul ignore next
    if (!self._secureChannel) {
        return callback(new Error("no channel"));
    }
    assert(self._secureChannel);

    const request = new CloseSessionRequest({
        deleteSubscriptions: deleteSubscriptions
    });

    if (!self._secureChannel.isValid()) {
        return callback();
    }
    session.performMessageTransaction(request, function (err, response) {

        if (err) {
            //xx console.log("xxx received : ", err, response);
            //xx self._secureChannel.close(function () {
            //xx     callback(err, null);
            //xx });
            callback(err, null);
        } else {
            callback(err, response);
        }
    });
};

/**
 *
 * @method closeSession
 * @async
 * @param session  {ClientSession} - the created client session
 * @param deleteSubscriptions  {Boolean} - whether to delete subscriptions or not
 * @param callback {Function} - the callback
 * @param callback.err {Error|null}   - the Error if the async method has failed
 */
OPCUAClient.prototype.closeSession = function (session, deleteSubscriptions, callback) {

    const self = this;
    assert(_.isBoolean(deleteSubscriptions));
    assert(_.isFunction(callback));
    assert(session);
    assert(session._client === self, "session must be attached to self");
    session._closed = true;
    //todo : send close session on secure channel
    self._closeSession(session, deleteSubscriptions, function (err) {

        session.emitCloseEvent();

        self._removeSession(session);
        session.dispose();

        assert(!_.contains(self._sessions, session));
        assert(session._closed, "session must indicate it is closed");

        callback(err);
    });
};


const repair_client_sessions= require("./reconnection").repair_client_sessions;

OPCUAClient.prototype._on_connection_reestablished = function (callback) {

    const self = this;
    assert(_.isFunction(callback));

    // call base class implementation first
    OPCUAClientBase.prototype._on_connection_reestablished.call(self, function (err) {
        repair_client_sessions(self,callback);
    });

};


OPCUAClient.prototype.toString = function () {
    OPCUAClientBase.prototype.toString.call(this);
    console.log("  requestedSessionTimeout....... ", this.requestedSessionTimeout);
    console.log("  endpointUrl................... ", this.endpointUrl);
    console.log("  serverUri..................... ", this.serverUri);
};

exports.OPCUAClient = OPCUAClient;
exports.ClientSession = ClientSession;

/**
 * @method withSession
 * @param inner_func {function}
 * @param inner_func.session {ClientSession}
 * @param inner_func.callback {function}
 * @param callback {function}
 */
OPCUAClient.prototype.withSession = function (endpointUrl, inner_func, callback) {

    assert(_.isFunction(inner_func), "expecting inner function");
    assert(_.isFunction(callback), "expecting callback function");

    const client = this;

    let the_session;
    let the_error;
    let need_disconnect = false;
    async.series([

        // step 1 : connect to
        function (callback) {
            client.connect(endpointUrl, function (err) {
                need_disconnect = true;
                if (err) {
                    console.log(" cannot connect to endpoint :", endpointUrl);
                }
                callback(err);
            });
        },

        // step 2 : createSession
        function (callback) {
            client.createSession(function (err, session) {
                if (!err) {
                    the_session = session;
                }
                callback(err);
            });
        },

        function (callback) {
            try {
                inner_func(the_session, function (err) {
                    the_error = err;
                    callback();
                });
            }
            catch (err) {
                console.log("OPCUAClient#withClientSession", err.message);
                the_error = err;
                callback();
            }
        },

        // close session
        function (callback) {
            the_session.close(/*deleteSubscriptions=*/true, function (err) {
                if (err) {
                    console.log("OPCUAClient#withClientSession: session closed failed ?");
                }
                callback();
            });
        },
        function (callback) {
            client.disconnect(function (err) {
                need_disconnect = false;
                if (err) {
                    console.log("OPCUAClient#withClientSession: client disconnect failed ?");
                }
                callback();
            });
        }

    ], function (err1) {
        if (need_disconnect) {
            console.log("Disconnecting client after failure");
            client.disconnect(function (err2) {
                return callback(the_error || err1 || err2);
            });
        } else {
            return callback(the_error || err1);
        }
    });
};


const thenify = require("thenify");
/**
 * @method connect
 * @param endpointUrl {string}
 * @async
 * @return {Promise}
 */
OPCUAClient.prototype.connect = thenify.withCallback(OPCUAClient.prototype.connect);
/**
 * @method disconnect
 * disconnect client from server
 * @return {Promise}
 * @async
 */
OPCUAClient.prototype.disconnect = thenify.withCallback(OPCUAClient.prototype.disconnect);
/**
 * @method createSession
 * @param [userIdentityInfo {Object} ] optional
 * @param [userIdentityInfo.userName {String} ]
 * @param [userIdentityInfo.password {String} ]
 * @return {Promise}
 * @async
 *
 * @example
 *     // create a anonymous session
 *     const session = await client.createSession();
 *
 * @example
 *     // create a session with a userName and password
 *     const userIdentityInfo  = { userName: "JoeDoe", password:"secret"};
 *     const session = client.createSession(userIdentityInfo);
 *
 */
OPCUAClient.prototype.createSession = thenify.withCallback(OPCUAClient.prototype.createSession);
/**
 * @method changeSessionIdentity
 * @param session
 * @param userIdentityInfo
 * @return {Promise}
 * @async
 */
OPCUAClient.prototype.changeSessionIdentity = thenify.withCallback(OPCUAClient.prototype.changeSessionIdentity);
/**
 * @method closeSession
 * @param session {ClientSession}
 * @param deleteSubscriptions  {Boolean} - whether to delete
 * @return {Promise}
 * @async
 * @example
 *    const session  = await client.createSession();
 *    await client.closeSession(session);
 */
OPCUAClient.prototype.closeSession = thenify.withCallback(OPCUAClient.prototype.closeSession);


const ClientSubscription = require("./client_subscription").ClientSubscription;
OPCUAClient.prototype.withSubscription = function (endpointUrl, subscriptionParameters, innerFunc, callback) {

    assert(_.isFunction(innerFunc));
    assert(_.isFunction(callback));

    this.withSession(endpointUrl, function (session, done) {
        assert(_.isFunction(done));

        const subscription = new ClientSubscription(session, subscriptionParameters);

        try {
            innerFunc(session, subscription, function () {

                subscription.terminate(function (err) {
                    done(err);
                });
            });

        }
        catch (err) {
            console.log(err);
            done(err);
        }
    }, callback);
};
//xx OPCUAClient.prototype.withSubscription = thenify(OPCUAClient.prototype.withSubscription);
const nodeVersion = parseInt(process.version.match(/v([0-9]*)\./)[1]);

if (nodeVersion >= 8) {
    require("./opcua_client_es2017_extensions");
}

