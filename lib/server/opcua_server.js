"use strict";
/*global: require Buffer*/
/**
 * @module opcua.server
 */

require("requirish")._(module);
var s = require("lib/datamodel/structures");
var ApplicationType = s.ApplicationType;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var assert = require("better-assert");

var async = require("async");
var util = require("util");
var path = require("path");
var fs = require("fs");
var _ = require("underscore");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var ServerEngine = require("lib/server/server_engine").ServerEngine;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

var browse_service = require("lib/services/browse_service");
var read_service = require("lib/services/read_service");
var write_service = require("lib/services/write_service");
var subscription_service = require("lib/services/subscription_service");
var register_server_service = require("lib/services/register_server_service");
var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var session_service = require("lib/services/session_service");
var call_service = require("lib/services/call_service");
var endpoints_service = require("lib/services/get_endpoints_service");
var ServerState = require("schemas/ServerState_enum").ServerState;
var EndpointDescription = endpoints_service.EndpointDescription;

var TimestampsToReturn = read_service.TimestampsToReturn;

var ActivateSessionRequest = session_service.ActivateSessionRequest;
var ActivateSessionResponse = session_service.ActivateSessionResponse;

var CreateSessionRequest = session_service.CreateSessionRequest;
var CreateSessionResponse = session_service.CreateSessionResponse;


var CloseSessionRequest = session_service.CloseSessionRequest;
var CloseSessionResponse = session_service.CloseSessionResponse;

var DeleteMonitoredItemsRequest = subscription_service.DeleteMonitoredItemsRequest;
var DeleteMonitoredItemsResponse = subscription_service.DeleteMonitoredItemsResponse;

var RepublishRequest = subscription_service.RepublishRequest;
var RepublishResponse = subscription_service.RepublishResponse;

var PublishRequest = subscription_service.PublishRequest;
var PublishResponse = subscription_service.PublishResponse;

var CreateSubscriptionRequest = subscription_service.CreateSubscriptionRequest;
var CreateSubscriptionResponse = subscription_service.CreateSubscriptionResponse;

var DeleteSubscriptionsRequest = subscription_service.DeleteSubscriptionsRequest;
var DeleteSubscriptionsResponse = subscription_service.DeleteSubscriptionsResponse;

var CreateMonitoredItemsRequest = subscription_service.CreateMonitoredItemsRequest;
var CreateMonitoredItemsResponse = subscription_service.CreateMonitoredItemsResponse;

var ModifyMonitoredItemsRequest  = subscription_service.ModifyMonitoredItemsRequest;
var ModifyMonitoredItemsResponse = subscription_service.ModifyMonitoredItemsResponse;
var MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;

var MonitoredItemCreateResult = subscription_service.MonitoredItemCreateResult;
var SetPublishingModeRequest = subscription_service.SetPublishingModeRequest;
var SetPublishingModeResponse = subscription_service.SetPublishingModeResponse;

var CallRequest = call_service.CallRequest;
var CallResponse = call_service.CallResponse;

var ReadRequest = read_service.ReadRequest;
var ReadResponse = read_service.ReadResponse;

var WriteRequest = write_service.WriteRequest;
var WriteResponse = write_service.WriteResponse;

var ReadValueId = read_service.ReadValueId;

var BrowseResponse = browse_service.BrowseResponse;
var BrowseRequest = browse_service.BrowseRequest;

var TranslateBrowsePathsToNodeIdsRequest = translate_service.TranslateBrowsePathsToNodeIdsRequest;
var TranslateBrowsePathsToNodeIdsResponse = translate_service.TranslateBrowsePathsToNodeIdsResponse;

var RegisterServerRequest = register_server_service.RegisterServerRequest;
var RegisterServerResponse = register_server_service.RegisterServerResponse;


var _ = require("underscore");
var NodeId = require("lib/datamodel/nodeid").NodeId;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;

var crypto = require("crypto");

var dump = require("lib/misc/utils").dump;
var constructFilename = require("lib/misc/utils").constructFilename;

var OPCUAServerEndPoint = require("lib/server/server_end_point").OPCUAServerEndPoint;

var OPCUABaseServer = require("lib/server/base_server").OPCUABaseServer;


var is_valid_dataEncoding = require("lib/misc/data_encoding").is_valid_dataEncoding;

var Factory = function Factory(engine) {
    assert(_.isObject(engine));
    this.engine = engine;
};

var factories = require("lib/misc/factories");

Factory.prototype.constructObject = function (id) {
    return factories.constructObject(id);
};

var default_maxAllowedSessionNumber = 10;




var package_json_file = constructFilename("package.json");
var package_info = JSON.parse(fs.readFileSync(package_json_file));

var default_build_info = {
    productName: "NODEOPCUA-SERVER",
    productUri: null, // << should be same as default_server_info.productUri?
    manufacturerName: "Node-OPCUA : MIT Licence ( see http://node-opcua.github.io/)",
    softwareVersion: package_info.version,
    buildDate: fs.statSync(package_json_file).mtime
};



/**
 * @class OPCUAServer
 * @extends  OPCUABaseServer
 * @uses ServerEngine
 * @param options
 * @param [options.defaultSecureTokenLifetime = 60000] {Number} the default secure token life time in ms.
 * @param [options.timeout=10000] {Number}              the HEL/ACK transaction timeout in ms. Use a large value
 *                                                      ( i.e 15000 ms) for slow connections or embedded devices.
 * @param [options.port= 26543] {Number}                the TCP port to listen to.
 * @param [options.maxAllowedSessionNumber = 10 ]       the maximum number of concurrent sessions allowed.
 *
 * @param [options.nodeset_filename]{Array<String>|String} the nodeset.xml files to load
 * @param [options.serverInfo = null]                   the information used in the end point description
 * @param [options.serverInfo.applicationUri = "urn:NodeOPCUA-SimpleDemoServer"] {String}
 * @param [options.serverInfo.productUri = "SimpleDemoServer"]{String}
 * @param [options.serverInfo.applicationName = {text: "applicationName"}]{LocalizedText}
 * @param [options.serverInfo.gatewayServerUri = null]{String}
 * @param [options.serverInfo.discoveryProfileUri= null]{String}
 * @param [options.serverInfo.discoveryUrls = []]{Array<String>}
 * @param [options.securityPolicies= [SecurityPolicy.None,SecurityPolicy.Basic128Rsa15,SecurityPolicy.Basic256]]
 * @param [options.securityModes= [MessageSecurityMode.NONE,MessageSecurityMode.SIGN,MessageSecurityMode.SIGNANDENCRYPT]]
 * @param [options.allowAnonymous = true] tells if the server default endpoints should allow anonymous connection.
 * @param [options.userManager = null ] a object that implement a method isValidUser(userName,password) to check if the
 * @param [options.resourcePath=null] {String} resource Path is a string added at the end of the url such as "/UA/Server"
 * @param [options.alternateHostname=null] {String} alternate hostname to use
 *  UserNameIdentityToken is valid.
 * @constructor
 */
function OPCUAServer(options) {

    options = options || {};

    OPCUABaseServer.apply(this, arguments);

    var self = this;

    self.options = options;


    // build Info
    var buildInfo = _.clone(default_build_info);
    buildInfo = _.extend(buildInfo, options.buildInfo);

    // repair product name
    buildInfo.productUri = buildInfo.productUri || self.serverInfo.productUri;
    self.serverInfo.productUri = self.serverInfo.productUri || buildInfo.productUri;

    self.engine = new ServerEngine({
        buildInfo: buildInfo,
        serverCapabilities: options.serverCapabilities,
        applicationUri: self.serverInfo.applicationUri
    });

    self.nonce = self.makeServerNonce();

    self.protocolVersion = 0;

    var port = options.port || 26543;
    assert(_.isFinite(port));

    self.objectFactory = new Factory(self.engine);

    // todo  should self.serverInfo.productUri  match self.engine.buildInfo.productUri ?

    options.allowAnonymous = ( options.allowAnonymous === undefined) ? true : options.allowAnonymous;

    // add the tcp/ip endpoint with no security
    var endPoint = new OPCUAServerEndPoint({
        port: port,
        defaultSecureTokenLifetime: options.defaultSecureTokenLifetime || 600000,
        timeout: options.timeout || 10000,
        certificate: self.getCertificate(),
        privateKey: self.getPrivateKey(),
        objectFactory: self.objectFactory,
        serverInfo: self.serverInfo
    });

    endPoint.addStandardEndpointDescriptions({
        securityPolicies: options.securityPolicies,
        securityModes: options.securityModes,
        allowAnonymous: options.allowAnonymous,
        resourcePath: options.resourcePath || "",
        hostname: options.alternateHostname
    });


    self.endpoints.push(endPoint);

    endPoint.on("message", function (message, channel) {
        self.on_request(message, channel);
    });

    endPoint.on("error", function (err) {
        console.log("OPCUAServer endpoint error", err);

        // set serverState to ServerState.Failed;
        self.engine.setServerState(ServerState.Failed);

        self.shutdown(function () {
        });
    });

    self.serverInfo.applicationType = ApplicationType.SERVER;

    self.maxAllowedSessionNumber = options.maxAllowedSessionNumber || default_maxAllowedSessionNumber;

    self.userManager = options.userManager || {
        isValidUser: function (/*userName,password*/) {
            return false;
        }
    };
    assert(_.isFunction(self.userManager.isValidUser));

}
util.inherits(OPCUAServer, OPCUABaseServer);

var ObjectRegisty = require("lib/misc/objectRegistry").ObjectRegisty;
var g_running_Servers= new ObjectRegisty();
OPCUAServer.getRunningServerCount = g_running_Servers.count.bind(g_running_Servers);


/**
 * total number of bytes written  by the server since startup
 * @property bytesWritten
 * @type {Number}
 */
OPCUAServer.prototype.__defineGetter__("bytesWritten", function () {

    return this.endpoints.reduce(function (accumulated, endpoint) {
        return accumulated + endpoint.bytesWritten;
    }, 0);
});

/**
 * total number of bytes read  by the server since startup
 * @property bytesRead
 * @type {Number}
 */
OPCUAServer.prototype.__defineGetter__("bytesRead", function () {
    return this.endpoints.reduce(function (accumulated, endpoint) {
        return accumulated + endpoint.bytesRead;
    }, 0);
});

/**
 * Number of transactions processed by the server since startup
 * @property transactionsCount
 * @type {Number}
 */
OPCUAServer.prototype.__defineGetter__("transactionsCount", function () {
    return this.endpoints.reduce(function (accumulated, endpoint) {
        return accumulated + endpoint.transactionsCount;
    }, 0);
});


/**
 * The server build info
 * @property buildInfo
 * @type {BuildInfo}
 */
OPCUAServer.prototype.__defineGetter__("buildInfo", function () {
    return this.engine.buildInfo;
});

/**
 * the number of connected channel on all existing end points
 * @property currentChannelCount
 * @type  {Number}
 *
 * TODO : move to base
 */
OPCUAServer.prototype.__defineGetter__("currentChannelCount", function () {

    var self = this;
    return self.endpoints.reduce(function (currentValue, endPoint) {
        return currentValue + endPoint.currentChannelCount;
    }, 0);
});


/**
 * The number of active subscriptions from all sessions
 * @property currentSubscriptionCount
 * @type {Number}
 */
OPCUAServer.prototype.__defineGetter__("currentSubscriptionCount", function () {
    var self = this;
    return self.engine.currentSubscriptionCount;
});

OPCUAServer.prototype.__defineGetter__("rejectedSessionCount", function () {
    return this.engine.rejectedSessionCount;
});
OPCUAServer.prototype.__defineGetter__("rejectedRequestsCount", function () {
    return this.engine.rejectedRequestsCount;
});
OPCUAServer.prototype.__defineGetter__("sessionAbortCount", function () {
    return this.engine.sessionAbortCount;
});
OPCUAServer.prototype.__defineGetter__("publishingIntervalCount", function () {
    return this.engine.publishingIntervalCount;
});

/**
 * create and register a new session
 * @method createSession
 * @return {ServerSession}
 */
OPCUAServer.prototype.createSession = function (options) {
    var self = this;
    return self.engine.createSession(options);
};

/**
 * the number of sessions currently active
 * @property currentSessionCount
 * @type {Number}
 */
OPCUAServer.prototype.__defineGetter__("currentSessionCount", function () {
    return this.engine.currentSessionCount;
});

/**
 * retrieve a session by authentication token
 * @method getSession
 *
 * @param authenticationToken
 * @param activeOnly search only for session that are not closed
 */
OPCUAServer.prototype.getSession = function (authenticationToken,activeOnly) {
    var self = this;
    return self.engine.getSession(authenticationToken,activeOnly);
};

/**
 * true if the server has been initialized
 * @property initialized
 * @type {Boolean}
 *
 */
OPCUAServer.prototype.__defineGetter__("initialized", function () {
    var self = this;
    return self.engine.address_space !== null;
});


/**
 * Initialize the server by installing default node set.
 *
 * @method initialize
 * @async
 *
 * This is a asynchronous function that requires a callback function.
 * The callback function typically completes the creation of custom node
 * and instruct the server to listen to its endpoints.
 *
 * @param {Function} done
 */
OPCUAServer.prototype.initialize = function (done) {

    var self = this;
    assert(!self.initialized);// already initialized ?

    g_running_Servers.register(self);

    self.engine.initialize(self.options, function () {
        self.emit("post_initialize");
        done();
    });
};


/**
 * Initiate the server by starting all its endpoints
 * @method start
 * @async
 * @param done {Function}
 */
OPCUAServer.prototype.start = function (done) {

    var self = this;
    var tasks = [];
    if (!self.initialized) {
        tasks.push(function (callback) {
            self.initialize(callback);
        });
    }
    tasks.push(function (callback) {
        OPCUABaseServer.prototype.start.call(self, function(err) {
            if (err) {
                self.shutdown(function(err2){
                    done(err);
                });
            }
            else {
                done(err);
            }
        });
    });

    async.series(tasks, done);

};

/**
 * shutdown all server endpoints
 * @method shutdown
 * @async
 * @param  [timeout=0] {Integer} the timeout before the server is actually shutted down
 * @param  done {Function}
 *
 *
 * @example
 *
 *    // shutdown immediatly
 *    server.shutdown(function(err) {
 *    });
 *
 *    // shutdown within 10 seconds
 *    server.shutdown(10000,function(err) {
 *    });
 */
OPCUAServer.prototype.shutdown = function (timeout, done) {

    if (_.isFunction(timeout) && !done) {
        done = timeout;
        timeout = 10;
    }
    var self = this;

    self.engine.setServerState(ServerState.Shutdown);

    setTimeout(function () {
        self.engine.shutdown();

        OPCUABaseServer.prototype.shutdown.call(self, function(err) {
            g_running_Servers.unregister(self);
            done(err);
        });

    }, timeout);

};

var computeSignature = require("lib/misc/security_policy").computeSignature;
var verifySignature = require("lib/misc/security_policy").verifySignature;

OPCUAServer.prototype.computeServerSignature = function (channel, clientCertificate, clientNonce) {
    var self = this;
    return computeSignature(clientCertificate, clientNonce, self.getPrivateKey(), channel.messageBuilder.securityPolicy);
};

OPCUAServer.prototype.verifyClientSignature = function (session, channel, clientSignature) {

    var self = this;

    var clientCertificate = channel.receiverCertificate;
    var securityPolicy = channel.messageBuilder.securityPolicy;
    var serverCertificate = self.getCertificate();
    var result = verifySignature(serverCertificate, session.nonce, clientSignature, clientCertificate, securityPolicy);

    return result;
};


var minSessionTimeout = 10; // 10 milliseconds
var defaultSessionTimeout = 1000; // 1 second
var maxSessionTimeout = 1000 * 60 * 5; // 5 minute

// session services
OPCUAServer.prototype._on_CreateSessionRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    var response;

    assert(request instanceof CreateSessionRequest);


    // check if session count hasn't reach the maximum allowed sessions
    if (server.currentSessionCount >= server.maxAllowedSessionNumber) {

        server.engine._rejectedSessionCount += 1;

        response = new CreateSessionResponse({responseHeader: {serviceResult: StatusCodes.BadTooManySessions}});
        return channel.send_response("MSG", response, message);
    }

    // Duration Requested maximum number of milliseconds that a Session should remain open without activity.
    // If the Client fails to issue a Service request within this interval, then the Server shall automatically
    // terminate the Client Session.
    var revisedSessionTimeout = request.requestedSessionTimeout || defaultSessionTimeout;
    revisedSessionTimeout = Math.min(revisedSessionTimeout, maxSessionTimeout);
    revisedSessionTimeout = Math.max(revisedSessionTimeout, minSessionTimeout);
    //xx console.log("xxxxx requested time out = ",request.requestedSessionTimeout," revised= ",revisedSessionTimeout);

    // Release 1.02 page 27 OPC Unified Architecture, Part 4: CreateSession.clientNonce
    // A random number that should never be used in any other request. This number shall have a minimum length of 32
    // bytes. Profiles may increase the required length. The Server shall use this value to prove possession of
    // its application instance Certificate in the response.
    if (!request.clientNonce || request.clientNonce.length < 32) {
        if (channel.securityMode !== endpoints_service.MessageSecurityMode.NONE) {
            console.log("SERVER with secure connection: Missing or invalid client Nonce ".red, request.clientNonce && request.clientNonce.toString("hex"));

            server.engine._rejectedSessionCount += 1;

            response = new CreateSessionResponse({responseHeader: {serviceResult: StatusCodes.BadNonceInvalid}});
            return channel.send_response("MSG", response, message);
        }
    }


    // see Release 1.02  27  OPC Unified Architecture, Part 4

    var session = server.createSession({sessionTimeout: revisedSessionTimeout});
    assert(session);

    session.clientDescription = request.clientDescription;
    session.sessionName  = request.sessionName;

    // Depending upon on the  SecurityPolicy  and the  SecurityMode  of the  SecureChannel,  the exchange of
    // ApplicationInstanceCertificates   and  Nonces  may be optional and the signatures may be empty. See
    // Part  7  for the definition of  SecurityPolicies  and the handling of these parameters


    // serverNonce:
    // A random number that should never be used in any other request.
    // This number shall have a minimum length of 32 bytes.
    // The Client shall use this value to prove possession of its application instance
    // Certificate in the ActivateSession request.
    // This value may also be used to prove possession of the userIdentityToken it
    // specified in the ActivateSession request.
    //
    // ( this serverNonce will only be used up to the _on_ActivateSessionRequest
    //   where a new nonce will be created)
    session.nonce = server.makeServerNonce();

    session.clientCertificate = request.clientCertificate;

    response = new CreateSessionResponse({
        // A identifier which uniquely identifies the session.
        sessionId: session.nodeId,

        // A unique identifier assigned by the Server to the Session.
        // The token used to authenticate the client in subsequent requests.
        authenticationToken: session.authenticationToken,

        revisedSessionTimeout: revisedSessionTimeout,

        serverNonce: session.nonce,

        // serverCertificate: type ApplicationServerCertificate
        // The application instance Certificate issued to the Server.
        // A Server shall prove possession by using the private key to sign the Nonce provided
        // by the Client in the request. The Client shall verify that this Certificate is the same as
        // the one it used to create the SecureChannel.
        // The ApplicationInstanceCertificate type is defined in 7.2.
        // If the securityPolicyUri is NONE and none of the UserTokenPolicies requires
        // encryption, the Server shall not send an ApplicationInstanceCertificate and the Client
        // shall ignore the ApplicationInstanceCertificate.
        serverCertificate: server.getCertificate(),

        // The endpoints provided by the server.
        // The Server shall return a set of EndpointDescriptions available for the serverUri
        // specified in the request.[...]
        // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery
        // Endpoint to fetch the EndpointDescriptions.
        // It is recommended that Servers only include the endpointUrl, securityMode,
        // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
        // other parameters set to null. Only the recommended parameters shall be verified by
        // the client.
        serverEndpoints: server._get_endpoints(),

        //This parameter is deprecated and the array shall be empty.
        serverSoftwareCertificates: null,

        // This is a signature generated with the private key associated with the
        // serverCertificate. This parameter is calculated by appending the clientNonce to the
        // clientCertificate and signing the resulting sequence of bytes.
        // The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm specified in the
        // SecurityPolicy for the Endpoint.
        // The SignatureData type is defined in 7.30.
        serverSignature: server.computeServerSignature(channel, request.clientCertificate, request.clientNonce),

        // The maximum message size accepted by the server
        // The Client Communication Stack should return a Bad_RequestTooLarge error to the
        // application if a request message exceeds this limit.
        // The value zero indicates that this parameter is not used.
        maxRequestMessageSize: 0x4000000

    });

    server.emit("create_session",session);

    session.on("session_closed",function(session,deleteSubscriptions){
        server.emit("session_closed",session,deleteSubscriptions);
    });

    assert(response.authenticationToken);
    channel.send_response("MSG", response, message);
};

var UserNameIdentityToken = session_service.UserNameIdentityToken;
var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;

OPCUAServer.prototype.isValidUserNameIdentityToken = function (channel, session, userTokenPolicy, userIdentityToken) {
    assert(userIdentityToken instanceof UserNameIdentityToken);
    //xx assert(userTokenPolicy instanceof UserTokenPolicy);

    var self = this;
    // decypher password

    var securityPolicy = securityPolicy_m.fromURI(userTokenPolicy.securityPolicyUri);
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = session.securityPolicy;
        assert(securityPolicy);
    }

    var serverPrivateKey = self.getPrivateKey();

    var serverNonce = session.nonce;
    assert(serverNonce instanceof Buffer);

    var cryptoFactory = securityPolicy_m.getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy");
    }

    var userName = userIdentityToken.userName;
    var password = userIdentityToken.password;

    var buff = cryptoFactory.asymmetricDecrypt(password, serverPrivateKey);
    var length = buff.readUInt32LE(0) - serverNonce.length;
    password = buff.slice(4, 4 + length).toString("utf-8");
//xx    console.log(" password : ",password);
    return self.userManager.isValidUser(userName, password);
};

function findUserTokenByPolicy(endpoint_description, policyId) {
    assert(endpoint_description instanceof EndpointDescription);
    var r = _.filter(endpoint_description.userIdentityTokens, function (userIdentity) {
        // assert(userIdentity instanceof UserTokenPolicy)
        assert(userIdentity.tokenType);
        return userIdentity.policyId === policyId;
    });
    return r.length === 0 ? null : r[0];
}

OPCUAServer.prototype.isValidUserIdentityToken = function (channel, session, userIdentityToken) {

    var self = this;
    assert(userIdentityToken);

    var endpoint_desc = channel.endpoint;
    assert(endpoint_desc instanceof EndpointDescription);

    var userTokenPolicy = findUserTokenByPolicy(endpoint_desc, userIdentityToken.policyId);
    if (!userTokenPolicy) {
        // cannot find token with this policyId
        return false;
    }

    // find if a userToken exists
    if (userIdentityToken instanceof UserNameIdentityToken) {
        return self.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken);
    }

    return true;
};

OPCUAServer.prototype.makeServerNonce = function () {
    return crypto.randomBytes(32);
};

// TODO : implement this:
//
// When the ActivateSession Service is called for the first time then the Server shall reject the request
// if the SecureChannel is not same as the one associated with the CreateSession request.
// Subsequent calls to ActivateSession may be associated with different SecureChannels. If this is the
// case then the Server shall verify that the Certificate the Client used to create the new
// SecureChannel is the same as the Certificate used to create the original SecureChannel. In addition,
// the Server shall verify that the Client supplied a UserIdentityToken that is identical to the token
// currently associated with the Session. Once the Server accepts the new SecureChannel it shall
// reject requests sent via the old SecureChannel.
/**
 *
 * @method _on_ActivateSessionRequest
 * @param message {Buffer}
 * @param channel {ServerSecureChannelLayer}
 * @private
 *
 *
 */
OPCUAServer.prototype._on_ActivateSessionRequest = function (message, channel) {

    var server = this;
    var request = message.request;
    assert(request instanceof ActivateSessionRequest);

    // get session from authenticationToken
    var authenticationToken = request.requestHeader.authenticationToken;

    var session = server.getSession(authenticationToken);

    function rejectConnection(statusCode) {
        server.engine._rejectedSessionCount += 1;
        var response = new ActivateSessionResponse({responseHeader: {serviceResult: statusCode}});
        channel.send_response("MSG", response, message);
        // and close !
    }

    var response;

    /* istanbul ignore next */
    if (!session) {
        console.log(" Bad Session in  _on_ActivateSessionRequest".yellow.bold, authenticationToken.value.toString("hex"));
        return rejectConnection(StatusCodes.BadSessionNotActivated);
    }

    if(session.status === "closed") {
        console.log(" Bad Session Closed in  _on_ActivateSessionRequest".yellow.bold, authenticationToken.value.toString("hex"));
        return rejectConnection(StatusCodes.BadSessionClosed);
    }


    // verify clientSignature provided by the client
    if (!server.verifyClientSignature(session, channel, request.clientSignature, session.clientCertificate)) {
        return rejectConnection(StatusCodes.BadApplicationSignatureInvalid);
    }

    // check request.userIdentityToken is correct ( expected type and correctly formed)
    if (!server.isValidUserIdentityToken(channel, session, request.userIdentityToken)) {
        return rejectConnection(StatusCodes.BadIdentityTokenInvalid);
    }
    // TO DO  check if the user is allowed
    //xx    if (!server.isUserAllowed(channel, session, request.userIdentityToken)) {
    //xx       return rejectConnection(StatusCodes.BadIdentityTokenRejected);
    //xx    }

    // extract : OPC UA part 4 - 5.6.3
    // Once used, a serverNonce cannot be used again. For that reason, the Server returns a new
    // serverNonce each time the ActivateSession Service is called.
    session.nonce = server.makeServerNonce();

    response = new ActivateSessionResponse({serverNonce: session.nonce});
    channel.send_response("MSG", response, message);
};


/**
 * ensure that action is performed on a valid session object,
 * @method _apply_on_SessionObject
 * @private
 */
OPCUAServer.prototype._apply_on_SessionObject = function (ResponseClass, message, channel, action_to_perform) {

    assert(_.isFunction(action_to_perform));

    var response;
    /* istanbul ignore next */
    if (!message.session) {

        var errMessage = "INVALID SESSION  !! ";
        debugLog(errMessage.red.bold);

        response = new ResponseClass({
           responseHeader: {serviceResult: StatusCodes.BadSessionNotActivated}
        });
        //xx var response = OPCUABaseServer.makeServiceFault(StatusCodes.BadSessionNotActivated,[errMessage]);
        return channel.send_response("MSG", response, message);
    }

    // OPC UA Specification 1.02 part 4 page 26
    // When a  Session  is terminated, all outstanding requests on the  Session  are aborted and
    // Bad_SessionClosed  StatusCodes  are returned to the  Client. In addition,   the  Server  deletes the entry
    // for the  Client  from its  SessionDiagnostics Array  Variable  and notifies any other  Clients  who were
    // subscribed to this entry.
    if (message.session.status === "closed") {
        //xxx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxx message.session.status ".red.bold,message.session.status.toString().cyan);
        response = new ResponseClass({
            responseHeader: { serviceResult: StatusCodes.BadSessionClosed}
        });
        //xx var response = OPCUABaseServer.makeServiceFault(StatusCodes.BadSessionNotActivated,[errMessage]);
        return channel.send_response("MSG", response, message);
    }

    // lets also reset the session watchdog so it doesn't
    // (Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
    // within the timeout period negotiated by the Server in the CreateSession Service response. )
    assert(_.isFunction(message.session.keepAlive));
    message.session.keepAlive();

    action_to_perform(message.session, message, channel);

};

/**
 * @method _on_CloseSessionRequest
 * @param message
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_CloseSessionRequest = function (message, channel) {

    var server = this;

    var request = message.request;
    assert(request instanceof CloseSessionRequest);
    assert(request.hasOwnProperty("deleteSubscriptions"));

    this._apply_on_SessionObject(CloseSessionResponse, message, channel, function (session) {

        assert(session !== null);

        var deleteSubscriptions = request.deleteSubscriptions || false;

        server.engine.closeSession(request.requestHeader.authenticationToken, deleteSubscriptions);

        var response = new CloseSessionResponse({});
        channel.send_response("MSG", response, message);
    });


};

function limitInputArray(nodeArray, maxNodes) {

    assert(_.isArray(nodeArray));
    assert(_.isNumber(maxNodes));
    // limit size of nodeArray array to maxNodes
    if (maxNodes && maxNodes < nodeArray.length) {
        // clipping  nodesToRead to maxRead
        nodeArray.splice(maxNodes, nodeArray.length);
        assert(nodeArray.length === maxNodes);
        return true; // limited
    }
    return false; //
}

// browse services
OPCUAServer.prototype._on_BrowseRequest = function (message, channel) {

    var server = this;

    var request = message.request;
    assert(request instanceof BrowseRequest);

    limitInputArray(request.nodesToBrowse, server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse);

    var results = [];
    if (request.nodesToBrowse.length > 0) {
        assert(request.nodesToBrowse[0]._schema.name === "BrowseDescription");
        results = server.engine.browse(request.nodesToBrowse);
        assert(results[0]._schema.name === "BrowseResult");

    }

    var response = new BrowseResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response, message);
};


// read services
OPCUAServer.prototype._on_ReadRequest = function (message, channel) {

    var server = this;

    this._apply_on_SessionObject(ReadResponse, message, channel, function (session) {

        var request = message.request;
        assert(request instanceof ReadRequest);

        var results = [];
        var response;

        var timestampsToReturn = request.timestampsToReturn;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            response = new ReadResponse({
                responseHeader: {serviceResult: StatusCodes.BadTimestampsToReturnInvalid}
            });
            channel.send_response("MSG", response, message);
            return;

        }

        if (request.maxAge < 0) {
            response = new ReadResponse({
                responseHeader: {serviceResult: StatusCodes.BadMaxAgeInvalid}
            });
            channel.send_response("MSG", response, message);
            return;
        }

        if (request.nodesToRead.length <= 0) {
            // ! BadNothingToDo
            response = new ReadResponse({
                responseHeader: {serviceResult: StatusCodes.BadNothingToDo}
            });
            channel.send_response("MSG", response, message);
            return;

        }
        assert(request.nodesToRead[0]._schema.name === "ReadValueId");
        assert(request.timestampsToReturn);

        // limit size of nodesToRead array to maxNodesPerRead
        limitInputArray(request.nodesToRead, server.engine.serverCapabilities.operationLimits.maxNodesPerRead);

        // ask for a refresh of asynchronous variables
        server.engine.refreshValues(request.nodesToRead, function (err) {

            assert(!err, " error not handled here , fix me");

            results = server.engine.read(request);

            assert(results[0]._schema.name === "DataValue");
            assert(results.length === request.nodesToRead.length);

            response = new ReadResponse({
                results: results,
                diagnosticInfos: null
            });
            channel.send_response("MSG", response, message);
        });

    });

};
/*
// write services
 // OPCUA Specification 1.02 Part 3 : 5.10.4 Write
 // This Service is used to write values to one or more Attributes of one or more Nodes. For constructed
 // Attribute values whose elements are indexed, such as an array, this Service allows Clients to write
 // the entire set of indexed values as a composite, to write individual elements or to write ranges of
 // elements of the composite.
 // The values are written to the data source, such as a device, and the Service does not return until it writes
 // the values or determines that the value cannot be written. In certain cases, the Server will successfully
 // to an intermediate system or Server, and will not know if the data source was updated properly. In these cases,
 // the Server should report a success code that indicates that the write was not verified.
 // In the cases where the Server is able to verify that it has successfully written to the data source,
 // it reports an unconditional success.
 */
OPCUAServer.prototype._on_WriteRequest = function (message, channel) {

    var server = this;

    var request = message.request;
    assert(request instanceof WriteRequest);
    assert(_.isArray(request.nodesToWrite));

    if (request.nodesToWrite.length === 0) {
        var response = new WriteResponse({responseHeader: {serviceResult: StatusCodes.BadNothingToDo}});
        return channel.send_response("MSG", response, message);
    }

    assert(request.nodesToWrite[0]._schema.name === "WriteValue");
    server.engine.write(request.nodesToWrite, function (err, results) {

        assert(_.isArray(results));
        assert(results.length === request.nodesToWrite.length);
        var response = new WriteResponse({
            results: results,
            diagnosticInfos: null
        });
        channel.send_response("MSG", response, message);

    });

};


// subscription services
OPCUAServer.prototype._on_CreateSubscriptionRequest = function (message, channel) {

    assert(message.request instanceof CreateSubscriptionRequest);

    this._apply_on_SessionObject(CreateSubscriptionResponse, message, channel, function (session) {

        var request = message.request;
        assert(_.isFinite(request.requestedPublishingInterval));

        var subscription = session.createSubscription(request);

        var response = new CreateSubscriptionResponse({
            subscriptionId:            subscription.id,
            revisedPublishingInterval: subscription.publishingInterval,
            revisedLifetimeCount:      subscription.lifeTimeCount,
            revisedMaxKeepAliveCount:  subscription.maxKeepAliveCount
        });
        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_DeleteSubscriptionsRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof DeleteSubscriptionsRequest);

    this._apply_on_SessionObject(DeleteSubscriptionsResponse, message, channel, function (session) {

        var results = request.subscriptionIds.map(function (subscriptionId) {
            return session.deleteSubscription(subscriptionId);
        });
        var response = new DeleteSubscriptionsResponse({
            results: results
        });
        channel.send_response("MSG", response, message);
    });
};

function are_same_values(v1, v2) {
    if (!v1 || !v2) {
        return !v1 && !v2;
    }
    if (!v1.value || !v2.value) {
        return !v1.value && !v2.value;
    }
    return _.isEqual(v1, v2);
}

/**
 *
 * perform the read operation on a given node for a monitored item.
 * this method DOES NOT apply to Variable Values attribute
 *
 * @param self
 * @param oldValue
 * @param node
 * @param itemToMonitor
 * @private
 */
function monitoredItem_read_and_record_value(self, oldValue, node, itemToMonitor) {

    assert(self instanceof MonitoredItem);
    //xx assert(itemToMonitor.attributeId !== AttributeIds.Value);
    var dataValue = node.readAttribute(itemToMonitor.attributeId);
    if (dataValue.statusCode === StatusCodes.Good) {
        if (!are_same_values(dataValue, oldValue)) {
            console.log("recordValue  ", dataValue.value.value,dataValue.statusCode.toString());
            self.recordValue(dataValue);
        }
    } else {
        /* istanbul ignore next */
        debugLog("readValue2 Error" + dataValue.statusCode.toString());
    }
}

/**
 * this method applies to Variable Values attribute
 * @param self
 * @param oldValue
 * @param node
 * @param itemToMonitor
 */
function monitoredItem_read_and_record_value_async(self, oldValue, node, itemToMonitor) {
    // do it asynchronously
    assert(itemToMonitor.attributeId === AttributeIds.Value);
    node.readValueAsync(function (err,dataValue) {
        //todo use dataValue instead of calling monitoredItem_read_and_record_value again
        if (!err) {
            // todo Apply filter
            self.recordValue(dataValue);
        }
    });
}


function sameVariant(v1,v2) {
    return _.isEqual(v1,v2);
}

function sameDataValue(v1,v2) {
    if (v1 === v2) { return true;}
    if (v1 && !v2) { return false;}
    if (v2 && !v1) { return false;}
    return sameVariant(v1.value,v2.value) && (v1.statusCode === v2.statusCode);
}

function build_scanning_node_function(engine, itemToMonitor) {

    assert(itemToMonitor instanceof ReadValueId);
    assert(engine.status === "initialized" && "engine must be initialized");

    var node = engine.findObject(itemToMonitor.nodeId);

    /* istanbul ignore next */
    if (!node) {

        console.log(" INVALID NODE ID  , ", itemToMonitor.nodeId.toString());
        dump(itemToMonitor);
        return function () {
            return new DataValue({
                statusCode: StatusCodes.BadNodeIdUnknown,
                value: {dataType: DataType.Null, value: 0}
            });
        };
    }

    if (itemToMonitor.attributeId === AttributeIds.Value) {

        var monitoredItem_read_and_record_value_func =
            (itemToMonitor.attributeId === AttributeIds.Value && _.isFunction(node.readValueAsync)) ?
                monitoredItem_read_and_record_value_async :
                monitoredItem_read_and_record_value;

        return function (oldDataValue) {
            assert(this instanceof MonitoredItem);
            return monitoredItem_read_and_record_value_func(this, oldDataValue, node, itemToMonitor);
        };

    } else {
        // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
        // The filter is not used for these  Attributes. Any change in value for these  Attributes
        // causes a  Notification  to be  generated.

        // only record value when it has changed
        return function (oldDataValue) {

            var self = this;
            assert(self instanceof MonitoredItem);

            var newDataValue = node.readAttribute(itemToMonitor.attributeId);
            if (!sameDataValue(newDataValue,oldDataValue)) {
                console.log("oldDataValue ",oldDataValue ? oldDataValue.toString().cyan:null);
                console.log("newDataValue ",newDataValue.toString().yellow)
                self.recordValue(newDataValue);
            }
        };
    }
}

OPCUAServer.prototype.prepare = function (message) {

    var server = this;
    var request = message.request;

    // --- check that session is correct
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);

    message.session = session;

    if (!session) {
        // may be session is
    }

};

OPCUAServer.prototype.__findMonitoredItem = function (nodeId) {
    var engine = this.engine;
    /* istanbul ignore next */
    if (!engine) {
        return null;
    }
    return engine.findObject(nodeId);
};

OPCUAServer.prototype._on_CreateMonitoredItemsRequest = function (message, channel) {

    var server = this;
    var engine = server.engine;
    var request = message.request;
    assert(request instanceof CreateMonitoredItemsRequest);



    this._apply_on_SessionObject(CreateMonitoredItemsResponse, message, channel, function (session) {

        var subscription = session.getSubscription(request.subscriptionId);
        var response;
        if (!subscription) {
            response = new CreateMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadSubscriptionIdInvalid}
            });

        } else {

            var timestampsToReturn = request.timestampsToReturn;

            if (timestampsToReturn === TimestampsToReturn.Invalid) {
                response = new CreateMonitoredItemsResponse({
                    responseHeader: {serviceResult: StatusCodes.BadTimestampsToReturnInvalid}
                });

            } else if(request.itemsToCreate.length === 0 ) {
                response = new CreateMonitoredItemsResponse({
                    responseHeader: {serviceResult: StatusCodes.BadNothingToDo}
                });

            } else {

                var results = request.itemsToCreate.map(function (monitoredItemCreateRequest) {

                    var itemToMonitor = monitoredItemCreateRequest.itemToMonitor;

                    var node = server.__findMonitoredItem(itemToMonitor.nodeId);
                    if (!node) {
                        // BadNodeIdInvalid
                        return new MonitoredItemCreateResult({statusCode: StatusCodes.BadNodeIdUnknown});
                    }

                    if (itemToMonitor.attributeId === AttributeIds.INVALID) {
                        return new MonitoredItemCreateResult({statusCode: StatusCodes.BadAttributeIdInvalid});
                    }
                    if (!itemToMonitor.indexRange.isValid()) {
                        return new MonitoredItemCreateResult({statusCode: StatusCodes.BadIndexRangeInvalid});
                    }

                    // check dataEncoding applies only on Values
                    if (itemToMonitor.dataEncoding.name && itemToMonitor.attributeId !== AttributeIds.Value ) {
                        return new MonitoredItemCreateResult({statusCode: StatusCodes.BadDataEncodingInvalid});
                    }

                    // check dataEncoding
                    if (!is_valid_dataEncoding(itemToMonitor.dataEncoding)) {
                        return new MonitoredItemCreateResult({statusCode: StatusCodes.BadDataEncodingUnsupported});
                    }
                    //xx var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
                    //xx var requestedParameters = monitoredItemCreateRequest.requestedParameters;

                    var monitoredItemCreateResult = subscription.createMonitoredItem(
                        timestampsToReturn, monitoredItemCreateRequest, node);

                    var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

                    var readNodeFunc = build_scanning_node_function(engine, itemToMonitor);

                    monitoredItem.on("samplingEvent", readNodeFunc);
                    return monitoredItemCreateResult;
                });

                response = new CreateMonitoredItemsResponse({
                    responseHeader: {serviceResult: StatusCodes.Good},
                    results: results
                    //,diagnosticInfos: []
                });
            }

        }
        channel.send_response("MSG", response, message);

    });

};

var ModifySubscriptionRequest = subscription_service.ModifySubscriptionRequest;
var ModifySubscriptionResponse = subscription_service.ModifySubscriptionResponse;

OPCUAServer.prototype._on_ModifySubscriptionRequest = function(message,channel) {
    var request = message.request;

    assert(request instanceof ModifySubscriptionRequest);
    this._apply_on_SessionObject(ModifySubscriptionResponse, message, channel, function (session) {

        var subscription = session.getSubscription(request.subscriptionId);
        var response;

        if (!subscription) {
            response = new ModifyMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadSubscriptionIdInvalid}
            });
            channel.send_response("MSG", response, message);
            return;
        }


        subscription.modify(request);

        var response = new CreateSubscriptionResponse({
            revisedPublishingInterval: subscription.publishingInterval,
            revisedLifetimeCount: subscription.lifeTimeCount,
            revisedMaxKeepAliveCount: subscription.maxKeepAliveCount
        });
        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_ModifyMonitoredItemsRequest = function(message,channel) {
    var request = message.request;

    assert(request instanceof ModifyMonitoredItemsRequest);
    this._apply_on_SessionObject(ModifyMonitoredItemsResponse, message, channel, function (session) {

        var subscription = session.getSubscription(request.subscriptionId);
        var response;

        if (!subscription) {
            response = new ModifyMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadSubscriptionIdInvalid}
            });
            channel.send_response("MSG", response, message);
            return;
        }

        var timestampsToReturn = request.timestampsToReturn;
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            response = new ModifyMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadTimestampsToReturnInvalid}
            });
            channel.send_response("MSG", response, message);
            return;
        }
        if(request.itemsToModify.length === 0 ) {
            response = new ModifyMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadNothingToDo}
            });
            channel.send_response("MSG", response, message);
            return;
        }

        var itemsToModify = request.itemsToModify; // MonitoredItemModifyRequest

        function modifyMonitoredItem(item) {

            var monitoredItemId = item.monitoredItemId;
            var monitoredItem = subscription.getMonitoredItem(monitoredItemId);
            if (!monitoredItem) {
                return new MonitoredItemModifyResult({ statusCode: StatusCodes.BadMonitoredItemIdInvalid });
            }
            return monitoredItem.modify(timestampsToReturn,item.requestedParameters);
        }

        var results =itemsToModify.map(modifyMonitoredItem);
        response = new ModifyMonitoredItemsResponse({
            results: results
        });

        channel.send_response("MSG", response, message);


    });

};

OPCUAServer.prototype._on_PublishRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof PublishRequest);

    this._apply_on_SessionObject(PublishResponse, message, channel, function (session) {
        assert(session);
        assert(session.publishEngine); // server.publishEngine doesn't exists, OPCUAServer has probably shut down already
        session.publishEngine._on_PublishRequest(request, function (request, response) {
            channel.send_response("MSG", response, message);
        });
    });
};


OPCUAServer.prototype._on_SetPublishingModeRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof SetPublishingModeRequest);

    this._apply_on_SessionObject(SetPublishingModeResponse, message, channel, function (session) {


        var publishingEnabled = request.publishingEnabled;
        var subscriptionIds = request.subscriptionIds;

        var results = subscriptionIds.map(function (subscriptionId) {

            var subscription = session.getSubscription(subscriptionId);
            if (!subscription) {
                return StatusCodes.BadSubscriptionIdInvalid;
            }
            return subscription.setPublishingMode(publishingEnabled);
        });

        var response = new SetPublishingModeResponse({
            results: results,
            diagnosticInfos: null
        });
        channel.send_response("MSG", response, message);
    });
};


OPCUAServer.prototype._on_DeleteMonitoredItemsRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof DeleteMonitoredItemsRequest);

    this._apply_on_SessionObject(DeleteMonitoredItemsResponse, message, channel, function (session) {

        var subscriptionId = request.subscriptionId;
        assert(subscriptionId !== null);

        var subscription = session.getSubscription(subscriptionId);
        var response;
        if (!subscription) {
            debugLog("Cannot find subscription ", subscriptionId);
            response = new DeleteMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadSubscriptionIdInvalid}
            });
        } else if (request.monitoredItemIds.length ===0 ) {
            response = new DeleteMonitoredItemsResponse({
                responseHeader: {serviceResult: StatusCodes.BadNothingToDo}
            });

        } else {

            var results = request.monitoredItemIds.map(function (monitoredItemId) {
                return subscription.removeMonitoredItem(monitoredItemId);
            });

            response = new DeleteMonitoredItemsResponse({
                results: results,
                diagnosticInfos: null
            });
        }
        channel.send_response("MSG", response, message);
    });
};

OPCUAServer.prototype._on_RepublishRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof RepublishRequest);

    this._apply_on_SessionObject(RepublishResponse, message, channel, function (session) {

        var response;

        var subscription = session.getSubscription(request.subscriptionId);

        if (!subscription) {
            response = new RepublishResponse({
                responseHeader: {
                    serviceResult: StatusCodes.BadSubscriptionIdInvalid
                }
            });

        } else {
            response = new RepublishResponse({
                responseHeader: {
                    serviceResult: StatusCodes.BadMessageNotAvailable
                },
                notificationMessage: {}
            });
        }
        channel.send_response("MSG", response, message);
    });
};

var SetMonitoringModeRequest = subscription_service.SetMonitoringModeRequest;
var SetMonitoringModeResponse = subscription_service.SetMonitoringModeResponse;

// Bad_NothingToDo
// Bad_TooManyOperations
// Bad_SubscriptionIdInvalid
// Bad_MonitoringModeInvalid
OPCUAServer.prototype._on_SetMonitoringModeRequest = function (message, channel) {

    var request = message.request;
    assert(request instanceof SetMonitoringModeRequest);

    var response;

    this._apply_on_SessionObject(RepublishResponse, message, channel, function (session) {

        var subscription = session.getSubscription(request.subscriptionId);

        if (!subscription) {
            response = new SetMonitoringModeResponse({
                responseHeader: {serviceResult: StatusCodes.BadSubscriptionIdInvalid}
            });
            return channel.send_response("MSG", response, message);
        }
        if (request.monitoredItemIds.length === 0) {
            response = new SetMonitoringModeResponse({
                responseHeader: {serviceResult: StatusCodes.BadNothingToDo}
            });
            return channel.send_response("MSG", response, message);
        }

        var monitoringMode = request.monitoringMode;

        if (monitoringMode === subscription_service.MonitoringMode.Invalid) {
            response = new SetMonitoringModeResponse({
                responseHeader: {serviceResult: StatusCodes.BadMonitoringModeInvalid}
            });
            return channel.send_response("MSG", response, message);
        }

        var results = request.monitoredItemIds.map(function (monitoredItemId) {

            var monitoredItem = subscription.getMonitoredItem(monitoredItemId);
            if (!monitoredItem) {
                return StatusCodes.BadMonitoredItemIdInvalid;
            }
            monitoredItem.setMonitoringMode(monitoringMode);
            return StatusCodes.Good;
        });

        response = new SetMonitoringModeResponse({
            results: results
        });
        channel.send_response("MSG", response, message);
    });

};

// _on_TranslateBrowsePathsToNodeIds service
OPCUAServer.prototype._on_TranslateBrowsePathsToNodeIdsRequest = function (message, channel) {

    var server = this;

    var request = message.request;
    assert(request instanceof TranslateBrowsePathsToNodeIdsRequest);

    var browsePathResults = request.browsePath.map(function (browsePath) {
        return server.engine.browsePath(browsePath);
    });
    var response = new TranslateBrowsePathsToNodeIdsResponse({
        results: browsePathResults,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response, message);
};


// Symbolic Id                   Description
//----------------------------  ----------------------------------------------------------------------------------------
// Bad_NodeIdInvalid             Used to indicate that the specified object is not valid.
//
// Bad_NodeIdUnknown             Used to indicate that the specified object is not valid.
//
// Bad_ArgumentsMissing          The client did not specify all of the input arguments for the method.
// Bad_UserAccessDenied
//
// Bad_MethodInvalid             The method id does not refer to a method for the specified object.
// Bad_OutOfRange                Used to indicate that an input argument is outside the acceptable range.
// Bad_TypeMismatch              Used to indicate that an input argument does not have the correct data type.
//                               A ByteString is structurally the same as a one dimensional array of Byte.
//                               A server shall accept a ByteString if an array of Byte is expected.
// Bad_NoCommunication

var getMethodDeclaration_ArgumentList = require("lib/datamodel/argument_list").getMethodDeclaration_ArgumentList;
var verifyArguments_ArgumentList = require("lib/datamodel/argument_list").verifyArguments_ArgumentList;

function callMethod(session, callMethodRequest, callback) {
    /* jshint validthis: true */
    var server = this;
    var address_space = server.engine.address_space;

    var objectId = callMethodRequest.objectId;
    var methodId = callMethodRequest.methodId;
    var inputArguments = callMethodRequest.inputArguments;

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);


    var response = getMethodDeclaration_ArgumentList(address_space, objectId, methodId);

    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, {statusCode: response.statusCode});
    }
    var methodDeclaration = response.methodDeclaration;

    // verify input Parameters
    var methodInputArguments = methodDeclaration.getInputArguments();

    response = verifyArguments_ArgumentList(methodInputArguments, inputArguments);
    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, response);
    }

    var methodObj = address_space.findObject(methodId);
    // invoke method on object
    var context = {
        session: session
    };

    methodObj.execute(inputArguments, context, function (err, callMethodResponse) {

        /* istanbul ignore next */
        if (err) {
            return callback(err);
        }

        callMethodResponse.inputArgumentResults = response.inputArgumentResults;
        assert(callMethodResponse.statusCode);

        if (callMethodResponse.statusCode === StatusCodes.Good) {
            assert(_.isArray(callMethodResponse.outputArguments));
        }

        assert(_.isArray(callMethodResponse.inputArgumentResults));
        assert(callMethodResponse.inputArgumentResults.length === methodInputArguments.length);

        return callback(null, callMethodResponse);
    });

}

var maximumOperationInCallRequest = 1000;


//Table 62 – Call Service Result Codes
// Symbolic Id Description
// Bad_NothingToDo       See Table 165 for the description of this result code.
// Bad_TooManyOperations See Table 165 for the description of this result code.
//
OPCUAServer.prototype._on_CallRequest = function (message, channel) {
    var server = this;

    this._apply_on_SessionObject(RepublishResponse, message, channel, function (session) {

        var request = message.request;
        var response;
        assert(request instanceof CallRequest);

        if (request.methodsToCall.length === 0) {
            // BadNothingToDo
            response = new CallResponse({responseHeader: {serviceResult: StatusCodes.BadNothingToDo}});
            return channel.send_response("MSG", response, message);
        }
        if (request.methodsToCall.length >= maximumOperationInCallRequest) {
            // BadTooManyOperations
            response = new CallResponse({responseHeader: {serviceResult: StatusCodes.BadTooManyOperations}});
            return channel.send_response("MSG", response, message);
        }

        async.map(request.methodsToCall, callMethod.bind(server, session), function (err, results) {
            assert(_.isArray(results));
            response = new CallResponse({results: results});
            channel.send_response("MSG", response, message);

        }, function (err) {
            /* istanbul ignore next */
            if (err) {
                channel.send_error_and_abort(StatusCodes.BadInternalError, err.message, "", function () {});
            }
        });
    });


};

/**
 * @method registerServer
 * @async
 * @param discovery_server_endpointUrl
 * @param callback
 */
OPCUAServer.prototype.registerServer = function (discovery_server_endpointUrl, callback) {


    var OPCUAClientBase = require("lib/client/client_base").OPCUAClientBase;

    var self = this;
    assert(self.serverType, " must have a valid server Type");

    var client = new OPCUAClientBase();

    function disconnect(callback) {
        client.disconnect(callback);
    }

    client.connect(discovery_server_endpointUrl, function (err) {
        /* istanbul ignore else */
        if (!err) {

            var request = new RegisterServerRequest({
                server: {
                    serverUri: "request.serverUri",
                    productUri: "request.productUri",
                    serverNames: [
                        {locale: "en", text: "MyServerName"}
                    ],
                    serverType: self.serverType,
                    gatewayServerUri: null,
                    discoveryUrls: [],
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });
            assert(request.requestHeader);
            client.performMessageTransaction(request, function (err, response) {
                // RegisterServerResponse
                assert(response instanceof RegisterServerResponse);
                disconnect(callback);
            });
        } else {
            console.log(" cannot register server to discovery server " + discovery_server_endpointUrl);
            console.log("   " + err.message);
            console.log(" make sure discovery server is up and running.");
            disconnect(callback);

        }
    });
};


exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;
