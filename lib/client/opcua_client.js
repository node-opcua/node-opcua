/**
 * @module opcua.client
 */
require("requirish")._(module);

var util = require("util");
var _ = require("underscore");
var assert = require("better-assert");

var s = require("lib/datamodel/structures");
var ActivateSessionRequest = s.ActivateSessionRequest;

var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var DataValue = require("lib/datamodel/datavalue").DataValue;

var OPCUAClientBase = require("lib/client/client_base").OPCUAClientBase;

var NodeId = require("lib/datamodel/nodeid").NodeId;

var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var session_service = require("lib/services/session_service");
var AnonymousIdentityToken = session_service.AnonymousIdentityToken;
var CreateSessionRequest = session_service.CreateSessionRequest;
var CreateSessionResponse = session_service.CreateSessionResponse;
var ActivateSessionRequest = session_service.ActivateSessionRequest;
var ActivateSessionResponse = session_service.ActivateSessionResponse;
var CloseSessionRequest = session_service.CloseSessionRequest;

var endpoints_service = require("lib/services/get_endpoints_service");
var ApplicationDescription = endpoints_service.ApplicationDescription;
var ApplicationType = endpoints_service.ApplicationType;

var ClientSession = require("lib/client/client_session").ClientSession;

/**
 * @class OPCUAClient
 * @extends OPCUAClientBase
 * @constructor
 */
function OPCUAClient() {
    OPCUAClientBase.apply(this, arguments);

    // @property endpoint_must_exist {Boolean}
    // if set to true , create Session will only accept connection from server which endpoint_url has been reported
    // by GetEndpointsRequest.
    // By default, the client is permissive.
    this.endpoint_must_exist = false;

}
util.inherits(OPCUAClient, OPCUAClientBase);


OPCUAClient.prototype._nextSessionName = function () {
    if (!this.___sessionName_counter) {
        this.___sessionName_counter = 0;
    }
    this.___sessionName_counter += 1;
    return 'Session' + this.___sessionName_counter;
};


OPCUAClient.prototype._createSession = function (callback) {

    assert(typeof(callback) === "function");
    assert(this._secureChannel);

    var endpoint = this.findEndpoint(this._secureChannel.endpoint_url);

    // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
    //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
    //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
    //   Client  shall report the difference and may close the  SecureChannel.

    if (!endpoint) {
        if (this.endpoint_must_exist) {
            callback(new Error(" End point must exist " + this._secureChannel.endpoint_url));
            return;
        } else {
            // fallback :
            // our strategy is to take the first server_end_point  instead as a default
            // ( is this really OK ?)
            // this will permit us to access a OPCUA Server using it's IP address instead of its hostname
            endpoint = this._server_endpoints[0];
        }
    }

    this.serverUri = endpoint.server.applicationUri;

    this.endpoint_url = this._secureChannel.endpoint_url;

    var applicationDescription = new ApplicationDescription({
        applicationUri: "urn:localhost:application:",
        productUri: "http://localhost/application",
        applicationName: {text: "MyApplication"},
        applicationType: ApplicationType.CLIENT,
        gatewayServerUri: undefined,
        discoveryProfileUri: undefined,
        discoveryUrls: []
    });

    assert(this.serverUri, " must have a valid server URI");
    assert(this.endpoint_url, " must have a valid server endpoint_url");

    var request = new CreateSessionRequest({
        clientDescription: applicationDescription,
        serverUri: this.serverUri,
        endpointUrl: this.endpoint_url,
        sessionName: this._nextSessionName(),
        clientNonce: this.getClientNonce(),
        clientCertificate: this.getCertificate(),
        requestedSessionTimeout: 300000,
        maxResponseMessageSize: 800000
    });

    var self = this;
    self._secureChannel.performMessageTransaction(request, function (err, response) {

        var session = null;
        if (!err) {

           //Xx console.log("xxxxx response",response.toString());
            console.log("xxxxx response",response.responseHeader.serviceResult);
            if (response.responseHeader.serviceResult === StatusCodes.BadTooManySessions) {

                err = new Error("Too Many Session");

            } else if (response.responseHeader.serviceResult === StatusCodes.Good) {

                assert(response instanceof CreateSessionResponse);

                // todo: verify SignedSoftwareCertificates and  response.serverSignature

                session = new ClientSession(self);
                session.name = request.sessionName;

                session.sessionId = response.sessionId;
                session.authenticationToken = response.authenticationToken;
                session.timeout = response.revisedSessionTimeout;
                session.serverNonce = response.serverNonce;
                session.serverCertificate = response.serverCertificate;
                session.serverSignature = response.serverSignature;
            } else {
                err = new Error("??? ",response.responseHeader.serviceResult.key);
            }
        }
        callback(err, session);

    });

};


// see OPCUA Part 4 - $7.35
OPCUAClient.prototype._activateSession = function (session, callback) {
    assert(typeof(callback) === "function");

    if (!this._secureChannel) {
        callback(new Error(" No secure channel"));
    }

    var request = new ActivateSessionRequest({
        clientSignature: {algorithm: null, signature: null},

        clientSoftwareCertificates: [],

        localeIds: [],

        userIdentityToken: this.userIdentityToken,

        userTokenSignature: {
            algorithm: null,
            signature: null
        }

    });

    session.performMessageTransaction(request, function (err, response) {

        if (!err) {

            assert(response instanceof ActivateSessionResponse);

            session.serverNonce = response.serverNonce;

            //var results = response.results;

            callback(null, session);

        } else {

            callback(err, null);
        }
    });
};

/**
 * create and activate a new session
 * @async
 * @method createSession
 * @param userIdentityToken
 * @param callback {Function}
 * @param callback.err     {Error|null}   - the Error if the async method has failed
 * @param callback.session {ClientSession} - the created session object.
 *
 */
OPCUAClient.prototype.createSession = function (userIdentityToken, callback) {

    var self = this;
    if (_.isFunction(userIdentityToken)) {
        callback = userIdentityToken;
        userIdentityToken = new AnonymousIdentityToken({policyId: "0"});
    }

    self.userIdentityToken = userIdentityToken;

    assert(_.isFunction(callback));

    self._createSession(function (err, session) {
        if (err) {
            callback(err);
        } else {
            self._activateSession(session, function (err) {
                assert(!_.contains(self._sessions, session));
                if (!err) {
                    self._sessions.push(session);
                    assert(_.contains(self._sessions, session));
                }
                callback(err, session);
            });
        }
    });

};

OPCUAClient.prototype._closeSession = function (session, callback) {

    assert(_.isFunction(callback));
    assert(session);
    assert(_.contains(this._sessions, session));
    if (!this._secureChannel) {
        return callback(new Error("no channel"));
    }
    assert(this._secureChannel);

    var request = new CloseSessionRequest({
        deleteSubscriptions: true
    });

    var self = this;
    session.performMessageTransaction(request, function (err, response) {

        if (err) {
            console.log(" received : ", err, response);
            self._secureChannel.close(function () {
                callback(err, null);
            });
        } else {
            callback(err, response);
        }
    });
};

/**
 *
 * @method closeSession
 * @async
 * @param session  {ClientSession} -
 * @param callback {Function} - the callback
 * @param callback.err {Error|null}   - the Error if the async method has failed
 */
OPCUAClient.prototype.closeSession = function (session, callback) {
    assert(_.isFunction(callback));
    assert(session);
    assert(_.contains(this._sessions, session));

    var self = this;
    //todo : send close session on secure channel
    self._closeSession(session, function (err) {
        var index = self._sessions.indexOf(session);
        if (index >= 0) {
            self._sessions.splice(index, 1);
            assert(!_.contains(self._sessions, session));
        }
        callback(err);
    });
};



exports.OPCUAClient = OPCUAClient;
exports.ClientSession = ClientSession;

