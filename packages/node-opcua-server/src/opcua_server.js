"use strict";
/*global: require Buffer*/
/**
 * @module opcua.server
 */

const assert = require("node-opcua-assert").assert;
const async = require("async");
const util = require("util");
const fs = require("fs");
const _ = require("underscore");

const ApplicationType = require("node-opcua-service-endpoints").ApplicationType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const SessionContext = require("node-opcua-address-space").SessionContext;
const fromURI = require("node-opcua-secure-channel").fromURI;
const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;

const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

const utils = require("node-opcua-utils");
const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const forceGarbageCollectionOnSessionClose = false;

const ServerEngine = require("./server_engine").ServerEngine;


const browse_service = require("node-opcua-service-browse");
const read_service = require("node-opcua-service-read");
const write_service = require("node-opcua-service-write");
const historizing_service = require("node-opcua-service-history");
const subscription_service = require("node-opcua-service-subscription");
const register_server_service = require("node-opcua-service-register-server");
const translate_service = require("node-opcua-service-translate-browse-path");
const session_service = require("node-opcua-service-session");
const register_node_service = require("node-opcua-service-register-node");
const call_service = require("node-opcua-service-call");
const endpoints_service = require("node-opcua-service-endpoints");
const query_service = require("node-opcua-service-query");

const ServerState = require("node-opcua-common").ServerState;
const EndpointDescription = endpoints_service.EndpointDescription;

const TimestampsToReturn = read_service.TimestampsToReturn;

const ActivateSessionRequest = session_service.ActivateSessionRequest;
const ActivateSessionResponse = session_service.ActivateSessionResponse;

const CreateSessionRequest = session_service.CreateSessionRequest;
const CreateSessionResponse = session_service.CreateSessionResponse;


const CloseSessionRequest = session_service.CloseSessionRequest;
const CloseSessionResponse = session_service.CloseSessionResponse;

const DeleteMonitoredItemsRequest = subscription_service.DeleteMonitoredItemsRequest;
const DeleteMonitoredItemsResponse = subscription_service.DeleteMonitoredItemsResponse;

const RepublishRequest = subscription_service.RepublishRequest;
const RepublishResponse = subscription_service.RepublishResponse;

const PublishRequest = subscription_service.PublishRequest;
const PublishResponse = subscription_service.PublishResponse;

const CreateSubscriptionRequest = subscription_service.CreateSubscriptionRequest;
const CreateSubscriptionResponse = subscription_service.CreateSubscriptionResponse;

const DeleteSubscriptionsRequest = subscription_service.DeleteSubscriptionsRequest;
const DeleteSubscriptionsResponse = subscription_service.DeleteSubscriptionsResponse;

const TransferSubscriptionsRequest = subscription_service.TransferSubscriptionsRequest;
const TransferSubscriptionsResponse = subscription_service.TransferSubscriptionsResponse;

const CreateMonitoredItemsRequest = subscription_service.CreateMonitoredItemsRequest;
const CreateMonitoredItemsResponse = subscription_service.CreateMonitoredItemsResponse;

const ModifyMonitoredItemsRequest = subscription_service.ModifyMonitoredItemsRequest;
const ModifyMonitoredItemsResponse = subscription_service.ModifyMonitoredItemsResponse;
const MonitoredItemModifyResult = subscription_service.MonitoredItemModifyResult;

const MonitoredItemCreateResult = subscription_service.MonitoredItemCreateResult;
const SetPublishingModeRequest = subscription_service.SetPublishingModeRequest;
const SetPublishingModeResponse = subscription_service.SetPublishingModeResponse;

const CallRequest = call_service.CallRequest;
const CallResponse = call_service.CallResponse;

const ReadRequest = read_service.ReadRequest;
const ReadResponse = read_service.ReadResponse;

const WriteRequest = write_service.WriteRequest;
const WriteResponse = write_service.WriteResponse;

const ReadValueId = read_service.ReadValueId;

const HistoryReadRequest = historizing_service.HistoryReadRequest;
const HistoryReadResponse = historizing_service.HistoryReadResponse;

const BrowseRequest = browse_service.BrowseRequest;
const BrowseResponse = browse_service.BrowseResponse;

const BrowseNextRequest = browse_service.BrowseNextRequest;
const BrowseNextResponse = browse_service.BrowseNextResponse;

const RegisterNodesRequest = register_node_service.RegisterNodesRequest;
const RegisterNodesResponse = register_node_service.RegisterNodesResponse;
const UnregisterNodesRequest = register_node_service.UnregisterNodesRequest;
const UnregisterNodesResponse = register_node_service.UnregisterNodesResponse;

const TranslateBrowsePathsToNodeIdsRequest = translate_service.TranslateBrowsePathsToNodeIdsRequest;
const TranslateBrowsePathsToNodeIdsResponse = translate_service.TranslateBrowsePathsToNodeIdsResponse;

const RegisterServerRequest = register_server_service.RegisterServerRequest;
const RegisterServerResponse = register_server_service.RegisterServerResponse;


const NodeId = require("node-opcua-nodeid").NodeId;
const DataValue = require("node-opcua-data-value").DataValue;
const DataType = require("node-opcua-variant").DataType;
const AttributeIds = require("node-opcua-data-model").AttributeIds;

const MonitoredItem = require("./monitored_item").MonitoredItem;

const View = require("node-opcua-address-space").View;

const crypto = require("crypto");

const dump = require("node-opcua-debug").dump;

const OPCUAServerEndPoint = require("./server_end_point").OPCUAServerEndPoint;

const OPCUABaseServer = require("./base_server").OPCUABaseServer;

const OPCUAClientBase = require("node-opcua-client").OPCUAClientBase;
const exploreCertificate = require("node-opcua-crypto").crypto_explore_certificate.exploreCertificate;


const Factory = function Factory(engine) {
    assert(_.isObject(engine));
    this.engine = engine;
};

const factories = require("node-opcua-factory");

Factory.prototype.constructObject = function (id) {
    return factories.constructObject(id);
};

const default_maxAllowedSessionNumber = 10;
const default_maxConnectionsPerEndpoint = 10;


function g_sendError(channel, message, ResponseClass, statusCode) {
    const response = new ResponseClass({
        responseHeader: {serviceResult: statusCode}
    });
    return channel.send_response("MSG", response, message);
}


const package_info = require("../package.json");

const default_build_info = {
    productName: "NODEOPCUA-SERVER",
    productUri: null, // << should be same as default_server_info.productUri?
    manufacturerName: "Node-OPCUA : MIT Licence ( see http://node-opcua.github.io/)",
    softwareVersion: package_info.version,
    //xx buildDate: fs.statSync(package_json_file).mtime
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
 * @param [options.serverInfo.applicationUri = "urn:NodeOPCUA-Server"] {String}
 * @param [options.serverInfo.productUri = "NodeOPCUA-Server"]{String}
 * @param [options.serverInfo.applicationName = {text: "applicationName"}]{LocalizedText}
 * @param [options.serverInfo.gatewayServerUri = null]{String}
 * @param [options.serverInfo.discoveryProfileUri= null]{String}
 * @param [options.serverInfo.discoveryUrls = []]{Array<String>}
 * @param [options.securityPolicies= [SecurityPolicy.None,SecurityPolicy.Basic128Rsa15,SecurityPolicy.Basic256]]
 * @param [options.securityModes= [MessageSecurityMode.NONE,MessageSecurityMode.SIGN,MessageSecurityMode.SIGNANDENCRYPT]]
 * @param [options.disableDiscovery = false] true if Discovery Service on unsecure channel shall be disabled
 * @param [options.allowAnonymous = true] tells if the server default endpoints should allow anonymous connection.
 * @param [options.userManager = null ] a object that implements user authentication methods
 * @param [options.userManager.isValidUser ] synchronous function to check the credentials - can be overruled by isValidUserAsync
 * @param [options.userManager.isValidUserAsync ] asynchronous function to check if the credentials - overrules isValidUser
 * @param [options.userManager.getUserRole ] synchronous function to return the role of the given user
 * @param [options.resourcePath=null] {String} resource Path is a string added at the end of the url such as "/UA/Server"
 * @param [options.alternateHostname=null] {String} alternate hostname to use
 * @param [options.maxConnectionsPerEndpoint=null]
 * @param [options.serverCapabilities]
 *  UserNameIdentityToken is valid.
 * @param [options.isAuditing = false] {Boolean} true if server shall raise AuditingEvent
 * @constructor
 */
function OPCUAServer(options) {

    options = options || {};

    OPCUABaseServer.apply(this, arguments);

    const self = this;

    self.options = options;


    self.maxAllowedSessionNumber = options.maxAllowedSessionNumber || default_maxAllowedSessionNumber;
    self.maxConnectionsPerEndpoint = options.maxConnectionsPerEndpoint || default_maxConnectionsPerEndpoint;

    // build Info
    let buildInfo = _.clone(default_build_info);
    buildInfo = _.extend(buildInfo, options.buildInfo);

    // repair product name
    buildInfo.productUri = buildInfo.productUri || self.serverInfo.productUri;
    self.serverInfo.productUri = self.serverInfo.productUri || buildInfo.productUri;
    self.serverInfo.productName = self.serverInfo.productName || buildInfo.productName;

    self.engine = new ServerEngine({
        buildInfo: buildInfo,
        serverCapabilities: options.serverCapabilities,
        applicationUri: self.serverInfo.applicationUri,
        isAuditing: options.isAuditing
    });

    self.nonce = self.makeServerNonce();

    self.protocolVersion = 0;

    const port = options.port || 26543;
    assert(_.isFinite(port));
    self.objectFactory = new Factory(self.engine);
    // todo  should self.serverInfo.productUri  match self.engine.buildInfo.productUri ?

    options.allowAnonymous = (options.allowAnonymous === undefined) ? true : options.allowAnonymous;

    //xx console.log(" maxConnectionsPerEndpoint = ",self.maxConnectionsPerEndpoint);

    // add the tcp/ip endpoint with no security
    const endPoint = new OPCUAServerEndPoint({
        port: port,
        defaultSecureTokenLifetime: options.defaultSecureTokenLifetime || 600000,
        timeout: options.timeout || 10000,
        certificateChain: self.getCertificateChain(),
        privateKey: self.getPrivateKey(),
        objectFactory: self.objectFactory,
        serverInfo: self.serverInfo,
        maxConnections: self.maxConnectionsPerEndpoint
    });

    endPoint.addStandardEndpointDescriptions({
        securityPolicies: options.securityPolicies,
        securityModes: options.securityModes,
        allowAnonymous: !!options.allowAnonymous,
        disableDiscovery: !!options.disableDiscovery,
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


    self.userManager = options.userManager || {};
    if (!_.isFunction(self.userManager.isValidUser)) {
        self.userManager.isValidUser = function (/*userName,password*/) {
            return false;
        };
    }
}

util.inherits(OPCUAServer, OPCUABaseServer);

const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
OPCUAServer.registry = new ObjectRegistry();


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
 * @type BuildInfo
 */
OPCUAServer.prototype.__defineGetter__("buildInfo", function () {
    return this.engine.buildInfo;
});

/**
 *
 * the number of connected channel on all existing end points
 * @property currentChannelCount
 * @type  Number
 */
OPCUAServer.prototype.__defineGetter__("currentChannelCount", function () {
    // TODO : move to base
    const self = this;
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
    const self = this;
    return self.engine.currentSubscriptionCount;
});

/**
 * @property rejectedSessionCount
 * @type {number}
 */
OPCUAServer.prototype.__defineGetter__("rejectedSessionCount", function () {
    return this.engine.rejectedSessionCount;
});
/**
 * @property rejectedSessionCount
 * @type {number}
 */
OPCUAServer.prototype.__defineGetter__("rejectedRequestsCount", function () {
    return this.engine.rejectedRequestsCount;
});
/**
 * @property sessionAbortCount
 * @type {number}
 */
OPCUAServer.prototype.__defineGetter__("sessionAbortCount", function () {
    return this.engine.sessionAbortCount;
});
/**
 * @property publishingIntervalCount
 * @type {number}
 */
OPCUAServer.prototype.__defineGetter__("publishingIntervalCount", function () {
    return this.engine.publishingIntervalCount;
});

/**
 * create and register a new session
 * @method createSession
 * @return {ServerSession}
 */
OPCUAServer.prototype.createSession = function (options) {
    const self = this;
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
 * @param activeOnly search only within sessions that are not closed
 */
OPCUAServer.prototype.getSession = function (authenticationToken, activeOnly) {
    const self = this;
    return self.engine.getSession(authenticationToken, activeOnly);
};

/**
 * true if the server has been initialized
 * @property initialized
 * @type {Boolean}
 *
 */
OPCUAServer.prototype.__defineGetter__("initialized", function () {
    const self = this;
    return self.engine.addressSpace !== null;
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

    const self = this;
    assert(!self.initialized);// already initialized ?

    OPCUAServer.registry.register(self);

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

    const self = this;
    const tasks = [];
    if (!self.initialized) {
        tasks.push(function (callback) {
            self.initialize(callback);
        });
    }
    tasks.push(function (callback) {
        OPCUABaseServer.prototype.start.call(self, function (err) {
            if (err) {
                self.shutdown(function (/*err2*/) {
                    callback(err);
                });
            }
            else {
                callback();
            }
        });
    });

    async.series(tasks, done);

};


OPCUAServer.fallbackSessionName = "Client didn't provide a meaningful sessionName ...";


/**
 * shutdown all server endpoints
 * @method shutdown
 * @async
 * @param  [timeout=0] {Number} the timeout before the server is actually shutdown
 * @param  callback      {Callback}
 * @param  callback.err  {Error|null}
 *
 *
 * @example
 *
 *    // shutdown immediately
 *    server.shutdown(function(err) {
 *    });
 *
 *    // shutdown within 10 seconds
 *    server.shutdown(10000,function(err) {
 *    });
 */
OPCUAServer.prototype.shutdown = function (timeout, callback) {


    if (!callback) {
        callback = timeout;
        timeout = 10;
    }
    assert(_.isFunction(callback));
    const self = this;

    debugLog("OPCUAServer#shutdown (timeout = ", timeout, ")");

    self.engine.setServerState(ServerState.Shutdown);

    setTimeout(function () {

        self.engine.shutdown();

        debugLog("OPCUAServer#shutdown: started");
        OPCUABaseServer.prototype.shutdown.call(self, function (err) {
            debugLog("OPCUAServer#shutdown: completed");

            self.dispose();
            callback(err);
        });

    }, timeout);

};

OPCUAServer.prototype.dispose = function() {

    const self = this;


    self.endpoints.forEach(function(endpoint){ endpoint.dispose();  });
    self.endpoints = [];

    self.removeAllListeners();

    OPCUAServer.registry.unregister(self);
};

const computeSignature = require("node-opcua-secure-channel").computeSignature;
const verifySignature = require("node-opcua-secure-channel").verifySignature;

OPCUAServer.prototype.computeServerSignature = function (channel, clientCertificate, clientNonce) {
    const self = this;
    return computeSignature(clientCertificate, clientNonce, self.getPrivateKey(), channel.messageBuilder.securityPolicy);
};


OPCUAServer.prototype.verifyClientSignature = function (session, channel, clientSignature) {

    const self = this;

    const clientCertificate = channel.receiverCertificate;
    const securityPolicy = channel.messageBuilder.securityPolicy;
    const serverCertificateChain = self.getCertificateChain();

    const result = verifySignature(serverCertificateChain, session.nonce, clientSignature, clientCertificate, securityPolicy);

    return result;
};


const minSessionTimeout = 100; // 100 milliseconds
const defaultSessionTimeout = 1000 * 30; // 30 seconds
const maxSessionTimeout = 1000 * 60 * 50; // 50 minutes

function _adjust_session_timeout(sessionTimeout) {
    let revisedSessionTimeout = sessionTimeout || defaultSessionTimeout;
    revisedSessionTimeout = Math.min(revisedSessionTimeout, maxSessionTimeout);
    revisedSessionTimeout = Math.max(revisedSessionTimeout, minSessionTimeout);
    return revisedSessionTimeout;
}

function channel_has_session(channel, session) {
    if (session.channel === channel) {
        assert(channel.sessionTokens.hasOwnProperty(session.authenticationToken.toString("hex")));
        return true;
    }
    return false;
}

function moveSessionToChannel(session, channel) {

    debugLog("moveSessionToChannel sessionId",session.sessionId," channelId=",channel.secureChannelId   );
    if (session.publishEngine) {
        session.publishEngine.cancelPendingPublishRequestBeforeChannelChange();
    }

    session._detach_channel();
    session._attach_channel(channel);

    assert(session.channel.secureChannelId === channel.secureChannelId);

}

function _attempt_to_close_some_old_unactivated_session(server) {

    const session = server.engine.getOldestUnactivatedSession();
    if (session) {
        server.engine.closeSession(session.authenticationToken, false, "Forcing");
    }
}


function onlyforUri(serverUri,endpoint) {
    assert(_.isString(serverUri));
    assert(endpoint instanceof EndpointDescription);
    // to do  ...
    return serverUri === endpoint.endpointUri;
}
function getRequiredEndpointInfo(endpoint) {
    assert(endpoint instanceof EndpointDescription);
    // It is recommended that Servers only include the endpointUrl, securityMode,
    // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
    // other parameters set to null. Only the recommended parameters shall be verified by
    // the client.

    const e=  new EndpointDescription({
        endpointUrl:      endpoint.endpointUrl,
        securityMode: endpoint.securityMode,
        securityPolicyUri: endpoint.securityPolicyUri,
        userIdentityTokens: endpoint.userIdentityTokens,
        transportProfileUri: endpoint.transportProfileUri,
        securityLevel: endpoint.securityLevel,
    });
    // reduce even further by explicitly setting unwanted members to null
    e.server =  null;
    e.serverCertificate = null;
    return e;
}
// serverUri  String This value is only specified if the EndpointDescription has a gatewayServerUri.
//            This value is the applicationUri from the EndpointDescription which is the applicationUri for the
//            underlying Server. The type EndpointDescription is defined in 7.10.

function _serverEndpointsForCreateSessionResponse(server,serverUri) {
    serverUri; // unused then
    // The Server shall return a set of EndpointDescriptions available for the serverUri specified in the request.
    // It is recommended that Servers only include the endpointUrl, securityMode,
    // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all other parameters
    // set to null. Only the recommended parameters shall be verified by the client.
    return server._get_endpoints()
        //xx .filter(onlyforUri.bind(null,serverUri)
        .map(getRequiredEndpointInfo);
}

// session services
OPCUAServer.prototype._on_CreateSessionRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof CreateSessionRequest);

    function rejectConnection(statusCode) {

        server.engine._rejectedSessionCount += 1;

        const response = new CreateSessionResponse({responseHeader: {serviceResult: statusCode}});
        channel.send_response("MSG", response, message);
        // and close !
    }

    // From OPCUA V1.03 Part 4 5.6.2 CreateSession
    // A Server application should limit the number of Sessions. To protect against misbehaving Clients and denial
    // of service attacks, the Server shall close the oldest Session that is not activated before reaching the
    // maximum number of supported Sessions
    if (server.currentSessionCount >= server.maxAllowedSessionNumber) {
        _attempt_to_close_some_old_unactivated_session(server);
    }

    // check if session count hasn't reach the maximum allowed sessions
    if (server.currentSessionCount >= server.maxAllowedSessionNumber) {
        return rejectConnection(StatusCodes.BadTooManySessions);
    }

    // Release 1.03 OPC Unified Architecture, Part 4 page 24 - CreateSession Parameters
    // client should prove a sessionName
    // Session name is a Human readable string that identifies the Session. The Server makes this name and the sessionId
    // visible in its AddressSpace for diagnostic purposes. The Client should provide a name that is unique for the
    // instance of the Client.
    // If this parameter is not specified the Server shall assign a value.

    if (utils.isNullOrUndefined(request.sessionName)) {
        // see also #198
        // let's the server assign a sessionName for this lazy client.
        debugLog("assigning OPCUAServer.fallbackSessionName because client's sessionName is null ", OPCUAServer.fallbackSessionName);
        request.sessionName = OPCUAServer.fallbackSessionName;
    }

    // Duration Requested maximum number of milliseconds that a Session should remain open without activity.
    // If the Client fails to issue a Service request within this interval, then the Server shall automatically
    // terminate the Client Session.
    const revisedSessionTimeout = _adjust_session_timeout(request.requestedSessionTimeout);


    // Release 1.02 page 27 OPC Unified Architecture, Part 4: CreateSession.clientNonce
    // A random number that should never be used in any other request. This number shall have a minimum length of 32
    // bytes. Profiles may increase the required length. The Server shall use this value to prove possession of
    // its application instance Certificate in the response.
    if (!request.clientNonce || request.clientNonce.length < 32) {
        if (channel.securityMode !== MessageSecurityMode.NONE) {
            console.log("SERVER with secure connection: Missing or invalid client Nonce ".red, request.clientNonce && request.clientNonce.toString("hex"));
            return rejectConnection(StatusCodes.BadNonceInvalid);
        }
    }


    function validate_applicationUri(applicationUri, clientCertificate) {

        // if session is insecure there is no need to check certificate information
        if (channel.securityMode === MessageSecurityMode.NONE) {
            return true; // assume correct
        }
        if (!clientCertificate || clientCertificate.length === 0) {
            return true;// can't check
        }
        const e = exploreCertificate(clientCertificate);
        const applicationUriFromCert = e.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier[0];
        return applicationUriFromCert === applicationUri;
    }

    // check application spoofing
    // check if applicationUri in createSessionRequest matches applicationUri in client Certificate
    if (!validate_applicationUri(request.clientDescription.applicationUri, request.clientCertificate)) {
        return rejectConnection(StatusCodes.BadCertificateUriInvalid);
    }

    function validate_security_endpoint(channel) {

        let endpoints = server._get_endpoints();

        // ignore restricted endpoints
        endpoints = endpoints.filter(function (endpoint) {
            return !endpoint.restricted;
        });

        const endpoints_matching_security_mode = endpoints.filter(function (e) {
            return e.securityMode === channel.securityMode;
        });
        if (endpoints_matching_security_mode.length === 0) {
            return StatusCodes.BadSecurityModeRejected;
        }
        const endpoints_matching_security_policy = endpoints_matching_security_mode.filter(function (e) {
            return e.securityPolicyUri === channel.securityHeader.securityPolicyUri;
        });

        if (endpoints_matching_security_policy.length === 0) {
            return StatusCodes.BadSecurityPolicyRejected;
        }
        return StatusCodes.Good;
    }

    const errStatus = validate_security_endpoint(channel);
    if (errStatus !== StatusCodes.Good) {
        return rejectConnection(errStatus);
    }

    //endpointUrl String The network address that the Client used to access the Session Endpoint. The HostName portion
    //            of the URL should be one of the HostNames for the application that are specified in the Server’s
    //            ApplicationInstanceCertificate (see 7.2). The Server shall raise an AuditUrlMismatchEventType event
    //            if the URL does not match the Server’s HostNames. AuditUrlMismatchEventType event type is defined in
    //            Part 5. The Server uses this information for diagnostics and to determine the set of
    //            EndpointDescriptions to return in the response.
    function validate_endpointUri() {
        // ToDo: check endpointUrl validity and emit an AuditUrlMismatchEventType event if not
    }
    validate_endpointUri();


    // see Release 1.02  27  OPC Unified Architecture, Part 4
    const session = server.createSession({
        sessionTimeout: revisedSessionTimeout,
        clientDescription: request.clientDescription
    });

    assert(session);
    assert(session.sessionTimeout === revisedSessionTimeout);

    session.clientDescription = request.clientDescription;
    session.sessionName = request.sessionName;

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
    session.secureChannelId = channel.secureChannelId;

    session._attach_channel(channel);

    const serverCertificateChain = server.getCertificateChain();

    const hasEncryption = true;
    // If the securityPolicyUri is NONE and none of the UserTokenPolicies requires encryption
    if (session.channel.securityMode === MessageSecurityMode.NONE) {
        // ToDo: Check that none of our unsecure endpoint has a a UserTokenPolicy that require encryption
        // and set hasEncryption = false under this condition
    }


    const response = new CreateSessionResponse({
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
        // The ApplicationInstanceCertificate type is defined in OpCUA 1.03 part 4 - $7.2 page 108
        // If the securityPolicyUri is NONE and none of the UserTokenPolicies requires
        // encryption, the Server shall not send an ApplicationInstanceCertificate and the Client
        // shall ignore the ApplicationInstanceCertificate.
        serverCertificate: hasEncryption ? serverCertificateChain : null,

        // The endpoints provided by the server.
        // The Server shall return a set of EndpointDescriptions available for the serverUri
        // specified in the request.[...]
        // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery
        // Endpoint to fetch the EndpointDescriptions.
        // It is recommended that Servers only include the endpointUrl, securityMode,
        // securityPolicyUri, userIdentityTokens, transportProfileUri and securityLevel with all
        // other parameters set to null. Only the recommended parameters shall be verified by
        // the client.
        serverEndpoints: _serverEndpointsForCreateSessionResponse(server,request.serverUri),

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


    server.emit("create_session", session);

    session.on("session_closed", function (session, deleteSubscriptions, reason) {


        assert(_.isString(reason));
        if (server.isAuditing) {

            assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");
            const sourceName = "Session/" + reason;

            server.raiseEvent("AuditSessionEventType", {
                /* part 5 -  6.4.3 AuditEventType */
                actionTimeStamp: {dataType: "DateTime", value: new Date()},
                status: {dataType: "Boolean", value: true},

                serverId: {dataType: "String", value: ""},

                // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                clientAuditEntryId: {dataType: "String", value: ""},

                // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
                // obtained from the UserIdentityToken passed in the ActivateSession call.
                clientUserId: {dataType: "String", value: ""},

                sourceName: {dataType: "String", value: sourceName},

                /* part 5 - 6.4.7 AuditSessionEventType */
                sessionId: {dataType: "NodeId", value: session.nodeId}

            });
        }

        server.emit("session_closed", session, deleteSubscriptions);

    });

    if (server.isAuditing) {

        // ----------------------------------------------------------------------------------------------------------------
        server.raiseEvent("AuditCreateSessionEventType", {

            /* part 5 -  6.4.3 AuditEventType */
            actionTimeStamp: {dataType: "DateTime", value: new Date()},
            status: {dataType: "Boolean", value: true},

            serverId: {dataType: "String", value: ""},

            // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
            clientAuditEntryId: {dataType: "String", value: ""},

            // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
            // obtained from the UserIdentityToken passed in the ActivateSession call.
            clientUserId: {dataType: "String", value: ""},

            sourceName: {dataType: "String", value: "Session/CreateSession"},

            /* part 5 - 6.4.7 AuditSessionEventType */
            sessionId: {dataType: "NodeId", value: session.nodeId},

            /* part 5 - 6.4.8 AuditCreateSessionEventType */
            // SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same identifier in
            // all AuditEvents related to the Session Service Set (AuditCreateSessionEventType, AuditActivateSessionEventType
            // and their subtypes) and the SecureChannel Service Set (AuditChannelEventType and its subtypes
            secureChannelId: {dataType: "String", value: session.channel.secureChannelId.toString()},

            // Duration
            revisedSessionTimeout: {dataType: "Duration", value: session.sessionTimeout},

            // clientCertificate
            clientCertificate: {dataType: "ByteString", value: session.channel.clientCertificate},

            // clientCertificateThumbprint
            clientCertificateThumbprint: {dataType: "ByteString", value: thumbprint(session.channel.clientCertificate)}

        });
    }
    // ----------------------------------------------------------------------------------------------------------------

    assert(response.authenticationToken);
    channel.send_response("MSG", response, message);
};

const UserNameIdentityToken = session_service.UserNameIdentityToken;
const AnonymousIdentityToken = session_service.AnonymousIdentityToken;

const getCryptoFactory = require("node-opcua-secure-channel").getCryptoFactory;

function adjustSecurityPolicy(channel, userTokenPolicy_securityPolicyUri) {
    // check that userIdentityToken
    let securityPolicy = fromURI(userTokenPolicy_securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = fromURI(channel.clientSecurityHeader.securityPolicyUri);
        assert(securityPolicy);
    }
    return securityPolicy;
}

OPCUAServer.prototype.isValidUserNameIdentityToken = function (channel, session, userTokenPolicy, userIdentityToken) {

    const self = this;

    assert(userIdentityToken instanceof UserNameIdentityToken);

    const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);

    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy");
    }

    if (userIdentityToken.encryptionAlgorithm !== cryptoFactory.asymmetricEncryptionAlgorithm) {
        console.log("invalid encryptionAlgorithm");
        console.log("userTokenPolicy", userTokenPolicy.toString());
        console.log("userTokenPolicy", userIdentityToken.toString());
        return false;
    }
    const userName = userIdentityToken.userName;
    const password = userIdentityToken.password;
    if (!userName || !password) {
        return false;
    }
    return true;
};

/**
 * @method userNameIdentityTokenAuthenticateUser
 * @param channel
 * @param session
 * @param userTokenPolicy
 * @param userIdentityToken
 * @param done {Function}
 * @param done.err {Error}
 * @param done.isAuthorized {Boolean}
 * @return  {*}
 */
OPCUAServer.prototype.userNameIdentityTokenAuthenticateUser = function (channel, session, userTokenPolicy, userIdentityToken, done) {

    const self = this;
    assert(userIdentityToken instanceof UserNameIdentityToken);
    assert(self.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken));

    const securityPolicy = adjustSecurityPolicy(channel, userTokenPolicy.securityPolicyUri);

    const serverPrivateKey = self.getPrivateKey();

    const serverNonce = session.nonce;
    assert(serverNonce instanceof Buffer);

    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        return done(new Error(" Unsupported security Policy"));
    }
    const userName = userIdentityToken.userName;
    let password = userIdentityToken.password;

    const buff = cryptoFactory.asymmetricDecrypt(password, serverPrivateKey);
    const length = buff.readUInt32LE(0) - serverNonce.length;
    password = buff.slice(4, 4 + length).toString("utf-8");

    if (_.isFunction(self.userManager.isValidUserAsync)) {
        self.userManager.isValidUserAsync.call(session, userName, password, done);
    } else {
        const authorized = self.userManager.isValidUser.call(session, userName, password);
        async.setImmediate(function () {
            done(null, authorized)
        });
    }

};


function findUserTokenByPolicy(endpoint_description, policyId) {
    assert(endpoint_description instanceof EndpointDescription);
    const r = _.filter(endpoint_description.userIdentityTokens, function (userIdentity) {
        // assert(userIdentity instanceof UserTokenPolicy)
        assert(userIdentity.tokenType);
        return userIdentity.policyId === policyId;
    });
    return r.length === 0 ? null : r[0];
}

const UserIdentityTokenType = require("node-opcua-service-endpoints").UserIdentityTokenType;
function findUserTokenPolicy(endpoint_description, userTokenType) {
    assert(endpoint_description instanceof EndpointDescription);
    const r = _.filter(endpoint_description.userIdentityTokens, function (userIdentity) {
        // assert(userIdentity instanceof UserTokenPolicy)
        assert(userIdentity.tokenType);
        return userIdentity.tokenType === userTokenType;
    });
    return r.length === 0 ? null : r[0];
}
function createAnonymousIdentityToken(endpoint_desc) {
    assert(endpoint_desc instanceof EndpointDescription);
    const userTokenPolicy = findUserTokenPolicy(endpoint_desc, UserIdentityTokenType.ANONYMOUS);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({policyId: userTokenPolicy.policyId});
}


OPCUAServer.prototype.isValidUserIdentityToken = function (channel, session, userIdentityToken) {

    const self = this;
    assert(userIdentityToken);

    const endpoint_desc = channel.endpoint;
    assert(endpoint_desc instanceof EndpointDescription);

    const userTokenPolicy = findUserTokenByPolicy(endpoint_desc, userIdentityToken.policyId);
    if (!userTokenPolicy) {
        // cannot find token with this policyId
        return false;
    }
    //
    if (userIdentityToken instanceof UserNameIdentityToken) {
        return self.isValidUserNameIdentityToken(channel, session, userTokenPolicy, userIdentityToken);
    }
    return true;
};


OPCUAServer.prototype.isUserAuthorized = function (channel, session, userIdentityToken, done) {

    const self = this;
    assert(userIdentityToken);
    assert(_.isFunction(done));

    const endpoint_desc = channel.endpoint;
    assert(endpoint_desc instanceof EndpointDescription);

    const userTokenPolicy = findUserTokenByPolicy(endpoint_desc, userIdentityToken.policyId);
    assert(userTokenPolicy);
    // find if a userToken exists
    if (userIdentityToken instanceof UserNameIdentityToken) {
        return self.userNameIdentityTokenAuthenticateUser(channel, session, userTokenPolicy, userIdentityToken, done);
    }
    async.setImmediate(done.bind(null, null, true));

};

OPCUAServer.prototype.makeServerNonce = function () {
    return crypto.randomBytes(32);
};

function sameIdentityToken(token1, token2) {

    if (token1 instanceof UserNameIdentityToken) {
        if (!(token2 instanceof UserNameIdentityToken)) {
            return false;
        }
        if (token1.userName !== token2.userName) {
            return false;
        }
        if (token1.password.toString("hex") !== token2.password.toString("hex")) {
            return false;
        }
    } else if (token1 instanceof AnonymousIdentityToken) {

        if (!(token2 instanceof AnonymousIdentityToken)) {
            return false;
        }
        if (token1.policyId !== token2.policyId) {
            return false;
        }
        return true;

    }
    assert(0, " Not implemented yet");
    return false;
}

function thumbprint(certificate) {
    return certificate ? certificate.toString("base64") : "";
}

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

    const server = this;
    const request = message.request;
    assert(request instanceof ActivateSessionRequest);

    // get session from authenticationToken
    const authenticationToken = request.requestHeader.authenticationToken;

    const session = server.getSession(authenticationToken);


    function rejectConnection(statusCode) {
        server.engine._rejectedSessionCount += 1;
        const response = new ActivateSessionResponse({responseHeader: {serviceResult: statusCode}});

        channel.send_response("MSG", response, message);
        // and close !
    }

    let response;

    /* istanbul ignore next */
    if (!session) {
        console.log(" Bad Session in  _on_ActivateSessionRequest".yellow.bold, authenticationToken.value.toString("hex"));
        return rejectConnection(StatusCodes.BadSessionNotActivated);
    }

    // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
    // When the ActivateSession  Service  is called f or the first time then the Server shall reject the request
    // if the  SecureChannel  is not same as the one associated with the  CreateSession  request.
    if (session.status === "new") {
        //xx if (channel.session_nonce !== session.nonce) {
        if (!channel_has_session(channel, session)) {
            // it looks like session activation is being using a channel that is not the
            // one that have been used to create the session
            console.log(" channel.sessionTokens === " + Object.keys(channel.sessionTokens).join(" "));
            return rejectConnection(StatusCodes.BadSessionNotActivated);
        }
    }

    // OpcUA 1.02 part 3 $5.6.3.1 ActiveSession Set page 29
    // ... Subsequent calls to  ActivateSession  may be associated with different  SecureChannels.  If this is the
    // case then  the  Server  shall verify that the  Certificate  the  Client  used to create the new
    // SecureChannel  is the same as the  Certificate  used to create the original  SecureChannel.

    if (session.status === "active") {

        if (session.channel.secureChannelId !== channel.secureChannelId) {

            console.log(" Session is being transferred from channel",
                session.channel.secureChannelId.toString().cyan,
                " to channel ", channel.secureChannelId.toString().cyan);

            // session is being reassigned to a new Channel,
            // we shall verify that the certificate used to create the Session is the same as the current channel certificate.
            const old_channel_cert_thumbprint = thumbprint(session.channel.clientCertificate);
            const new_channel_cert_thumbprint = thumbprint(channel.clientCertificate);
            if (old_channel_cert_thumbprint !== new_channel_cert_thumbprint) {
                return rejectConnection(StatusCodes.BadNoValidCertificates); // not sure about this code !
            }

            // ... In addition the Server shall verify that the  Client  supplied a  UserIdentityToken  that is   identical to
            // the token currently associated with the  Session reassign session to new channel.
            if (!sameIdentityToken(session.userIdentityToken, request.userIdentityToken)) {
                return rejectConnection(StatusCodes.BadIdentityChangeNotSupported); // not sure about this code !
            }
        }

        moveSessionToChannel(session, channel);


    } else if (session.status === "screwed") {
        // session has been used before being activated => this should be detected and session should be dismissed.
        return rejectConnection(StatusCodes.BadSessionClosed);
    } else if (session.status === "closed") {
        console.log(" Bad Session Closed in  _on_ActivateSessionRequest".yellow.bold, authenticationToken.value.toString("hex"));
        return rejectConnection(StatusCodes.BadSessionClosed);
    }

    // verify clientSignature provided by the client
    if (!server.verifyClientSignature(session, channel, request.clientSignature, session.clientCertificate)) {
        return rejectConnection(StatusCodes.BadApplicationSignatureInvalid);
    }

    // userIdentityToken may be missing , assume anonymous access then
    request.userIdentityToken = request.userIdentityToken || createAnonymousIdentityToken(channel.endpoint);

    // check request.userIdentityToken is correct ( expected type and correctly formed)
    if (!server.isValidUserIdentityToken(channel, session, request.userIdentityToken)) {
        return rejectConnection(StatusCodes.BadIdentityTokenInvalid);
    }
    session.userIdentityToken = request.userIdentityToken;

    // check if user access is granted
    server.isUserAuthorized(channel, session, request.userIdentityToken, function (err, authorized) {

        if (err) {
            return rejectConnection(StatusCodes.BadInternalError);
        }

        if (!authorized) {
            return rejectConnection(StatusCodes.BadUserAccessDenied);
        } else {
            // extract : OPC UA part 4 - 5.6.3
            // Once used, a serverNonce cannot be used again. For that reason, the Server returns a new
            // serverNonce each time the ActivateSession Service is called.
            session.nonce = server.makeServerNonce();

            session.status = "active";

            response = new ActivateSessionResponse({serverNonce: session.nonce});
            channel.send_response("MSG", response, message);

            const userIdentityTokenPasswordRemoved = function (userIdentityToken) {
                const a = userIdentityToken;
                // to do remove password
                return a;
            };

            // send OPCUA Event Notification
            // see part 5 : 6.4.3 AuditEventType
            //              6.4.7 AuditSessionEventType
            //              6.4.10 AuditActivateSessionEventType
            const VariantArrayType = require("node-opcua-variant").VariantArrayType;
            assert(session.nodeId); // sessionId
            //xx assert(session.channel.clientCertificate instanceof Buffer);
            assert(session.sessionTimeout > 0);

            if (server.isAuditing) {
                server.raiseEvent("AuditActivateSessionEventType", {

                    /* part 5 -  6.4.3 AuditEventType */
                    actionTimeStamp: {dataType: "DateTime", value: new Date()},
                    status: {dataType: "Boolean", value: true},

                    serverId: {dataType: "String", value: ""},

                    // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
                    clientAuditEntryId: {dataType: "String", value: ""},

                    // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
                    // obtained from the UserIdentityToken passed in the ActivateSession call.
                    clientUserId: {dataType: "String", value: "cc"},

                    sourceName: {dataType: "String", value: "Session/ActivateSession"},

                    /* part 5 - 6.4.7 AuditSessionEventType */
                    sessionId: {dataType: "NodeId", value: session.nodeId},

                    /* part 5 - 6.4.10 AuditActivateSessionEventType */
                    clientSoftwareCertificates: {
                        dataType: "ExtensionObject" /* SignedSoftwareCertificate */,
                        arrayType: VariantArrayType.Array,
                        value: []
                    },
                    // UserIdentityToken reflects the userIdentityToken parameter of the ActivateSession Service call.
                    // For Username/Password tokens the password should NOT be included.
                    userIdentityToken: {
                        dataType: "ExtensionObject" /*  UserIdentityToken */,
                        value: userIdentityTokenPasswordRemoved(session.userIdentityToken)
                    },

                    // SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same identifier
                    // in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
                    // AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
                    // (AuditChannelEventType and its subtypes).
                    secureChannelId: {dataType: "String", value: session.channel.secureChannelId.toString()}

                });
            }
        }
    });

};


OPCUAServer.prototype.raiseEvent = function (eventType, options) {

    const self = this;

    if (!self.engine.addressSpace) {
        console.log("addressSpace missing");
        return;
    }

    const server = self.engine.addressSpace.findNode("Server");

    if (!server) {
        //xx throw new Error("OPCUAServer#raiseEvent : cannot find Server object");
        return;
    }

    let eventTypeNode = eventType;
    if (typeof(eventType) === "string") {
        eventTypeNode = self.engine.addressSpace.findEventType(eventType);
    }

    if (eventTypeNode) {
        return server.raiseEvent(eventTypeNode, options);
    } else {
        console.warn(" cannot find event type ", eventType);
    }
};


/**
 * ensure that action is performed on a valid session object,
 * @method _apply_on_SessionObject
 * @param ResponseClass {Constructor} the constructor of the response Class
 * @param message
 * @param channel
 * @param action_to_perform {Function}
 * @param action_to_perform.session {ServerSession}
 * @param action_to_perform.sendResponse {Function}
 * @param action_to_perform.sendResponse.response {ResponseClass}
 * @param action_to_perform.sendError {Function}
 * @param action_to_perform.sendError.statusCode {StatusCode}
 * @param action_to_perform.sendError.diagnostics {DiagnosticsInfo}
 *
 * @private
 */
OPCUAServer.prototype._apply_on_SessionObject = function (ResponseClass, message, channel, action_to_perform) {

    assert(_.isFunction(action_to_perform));

    function sendResponse(response) {
        assert(response instanceof ResponseClass);
        if (message.session) {
            message.session.incrementRequestTotalCounter(ResponseClass.name.replace("Response",""));
        }
        return channel.send_response("MSG", response, message);
    }

    function sendError(statusCode, diagnostics) {

        if (message.session) {
            message.session.incrementRequestErrorCounter(ResponseClass.name.replace("Response", ""));
        }
        return g_sendError(channel, message, ResponseClass, statusCode, diagnostics);
    }

    let response;
    /* istanbul ignore next */
    if (!message.session || message.session_statusCode !== StatusCodes.Good) {
        const errMessage = "INVALID SESSION  !! ";
        response = new ResponseClass({responseHeader: {serviceResult: message.session_statusCode}});
        debugLog(errMessage.red.bold , message.session_statusCode.toString().yellow,response.constructor.name);
        return sendResponse(response);
    }

    assert(message.session_statusCode === StatusCodes.Good);

    // OPC UA Specification 1.02 part 4 page 26
    // When a  Session  is terminated, all outstanding requests on the  Session  are aborted and
    // Bad_SessionClosed  StatusCodes  are returned to the  Client. In addition,   the  Server  deletes the entry
    // for the  Client  from its  SessionDiagnostics Array  Variable  and notifies any other  Clients  who were
    // subscribed to this entry.
    if (message.session.status === "closed") {
        //note : use StatusCodes.BadSessionClosed , for pending message for this session
        //xx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxx message.session.status ".red.bold,message.session.status.toString().cyan);
        return sendError(StatusCodes.BadSessionIdInvalid);
    }

    if (message.session.status !== "active") {

        // mark session as being screwed ! so it cannot be activated anymore
        message.session.status = "screwed";

        //note : use StatusCodes.BadSessionClosed , for pending message for this session
        return sendError(StatusCodes.BadSessionNotActivated);
    }


    // lets also reset the session watchdog so it doesn't
    // (Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
    // within the timeout period negotiated by the Server in the CreateSession Service response. )
    assert(_.isFunction(message.session.keepAlive));
    message.session.keepAlive();

    message.session.incrementTotalRequestCount();

    action_to_perform(message.session, sendResponse, sendError);
};

/**
 * @method _apply_on_Subscription
 * @param ResponseClass
 * @param message
 * @param channel
 * @param action_to_perform
 * @private
 */
OPCUAServer.prototype._apply_on_Subscription = function (ResponseClass, message, channel, action_to_perform) {

    assert(_.isFunction(action_to_perform));
    const request = message.request;
    assert(request.hasOwnProperty("subscriptionId"));

    this._apply_on_SessionObject(ResponseClass, message, channel, function (session, sendResponse, sendError) {
        const subscription = session.getSubscription(request.subscriptionId);
        if (!subscription) {
            return sendError(StatusCodes.BadSubscriptionIdInvalid);
        }
        subscription.resetLifeTimeAndKeepAliveCounters();
        action_to_perform(session, subscription, sendResponse, sendError);
    });
};

/**
 * @method _apply_on_SubscriptionIds
 * @param ResponseClass
 * @param message
 * @param channel
 * @param action_to_perform
 * @private
 */
OPCUAServer.prototype._apply_on_SubscriptionIds = function (ResponseClass, message, channel, action_to_perform) {

    assert(_.isFunction(action_to_perform));
    const request = message.request;
    assert(request.hasOwnProperty("subscriptionIds"));

    this._apply_on_SessionObject(ResponseClass, message, channel, function (session, sendResponse, sendError) {

        const subscriptionIds = request.subscriptionIds;

        if (!request.subscriptionIds || request.subscriptionIds.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        const results = subscriptionIds.map(function (subscriptionId) {
            return action_to_perform(session, subscriptionId)
        });

        const response = new ResponseClass({
            results: results
        });
        sendResponse(response);

    });
};

/**
 * @method _apply_on_Subscriptions
 * @param ResponseClass
 * @param message
 * @param channel
 * @param action_to_perform
 * @private
 */
OPCUAServer.prototype._apply_on_Subscriptions = function (ResponseClass, message, channel, action_to_perform) {

    this._apply_on_SubscriptionIds(ResponseClass, message, channel, function (session, subscriptionId) {
        if (subscriptionId <= 0) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }
        const subscription = session.getSubscription(subscriptionId);
        if (!subscription) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }
        return action_to_perform(session, subscription);
    });
};


/**
 * @method _on_CloseSessionRequest
 * @param message
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_CloseSessionRequest = function (message, channel) {

    const server = this;

    const request = message.request;
    assert(request instanceof CloseSessionRequest);

    let response;

    message.session_statusCode = StatusCodes.Good;

    function sendError(statusCode) {
        return g_sendError(channel, message, CloseSessionResponse, statusCode);
    }
    function sendResponse(response) {
        channel.send_response("MSG",response,message);
    }
    // do not use _apply_on_SessionObject
    //this._apply_on_SessionObject(CloseSessionResponse, message, channel, function (session) {
    //});

    const session = message.session;
    if (!session) {
        return sendError(StatusCodes.BadSessionIdInvalid);
    }

    // session has been created but not activated !
    const wasNotActivated = (session.status === "new");

    server.engine.closeSession(request.requestHeader.authenticationToken, request.deleteSubscriptions, "CloseSession");

    if (wasNotActivated) {
        return sendError(StatusCodes.BadSessionNotActivated);
    }
    response = new CloseSessionResponse({});
    sendResponse(response);


    if (forceGarbageCollectionOnSessionClose) {
        if (global.gc) {
            global.gc(true);
            try {
                require("heapdump").writeSnapshot();
            }
            catch(err) {
                /* */
            }
        }
    }
 };


// browse services
/**
 * @method _on_BrowseRequest
 * @param message
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_BrowseRequest = function (message, channel) {
    const server = this;
    const request = message.request;
    assert(request instanceof BrowseRequest);
    const diagnostic = {};

    this._apply_on_SessionObject(BrowseResponse, message, channel, function (session, sendResponse, sendError) {
        let response;
        // test view
        if (request.view && !request.view.viewId.isEmpty()) {
            //xx console.log("xxxx ",request.view.toString());
            //xx console.log("xxxx NodeClas",View.prototype.nodeClass);
            let theView = server.engine.addressSpace.findNode(request.view.viewId);
            if (theView && theView.constructor.nodeClass !== View.prototype.nodeClass) {
                // Error: theView is not a View
                diagnostic.localizedText = {text: "blah"};
                theView = null;
            }
            if (!theView) {
                return sendError(StatusCodes.BadViewIdUnknown, diagnostic);
            }
        }

        if (!request.nodesToBrowse || request.nodesToBrowse.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        if (server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse > 0) {
            if (request.nodesToBrowse.length > server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        // ToDo: limit results to requestedMaxReferencesPerNode
        const requestedMaxReferencesPerNode = request.requestedMaxReferencesPerNode;

        let results = [];
        assert(request.nodesToBrowse[0]._schema.name === "BrowseDescription");
        results = server.engine.browse(request.nodesToBrowse, session);
        assert(results[0]._schema.name === "BrowseResult");

        // handle continuation point and requestedMaxReferencesPerNode
        results = results.map(function (result) {
            assert(!result.continuationPoint);
            const r = session.continuationPointManager.register(requestedMaxReferencesPerNode, result.references);
            assert(r.statusCode === StatusCodes.Good);
            r.statusCode = result.statusCode;
            return r;
        });

        response = new BrowseResponse({
            results: results,
            diagnosticInfos: null
        });
        sendResponse(response);
    });
};

/**
 * @method _on_BrowseNextRequest
 * @param message
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_BrowseNextRequest = function (message, channel) {


    const request = message.request;
    assert(request instanceof BrowseNextRequest);

    this._apply_on_SessionObject(BrowseNextResponse, message, channel, function (session, sendResponse, sendError) {

        let response;

        if (!request.continuationPoints || request.continuationPoints.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        // A Boolean parameter with the following values:

        let results;
        if (request.releaseContinuationPoints) {
            //releaseContinuationPoints = TRUE
            //   passed continuationPoints shall be reset to free resources in
            //   the Server. The continuation points are released and the results
            //   and diagnosticInfos arrays are empty.
            results = request.continuationPoints.map(function (continuationPoint) {
                return session.continuationPointManager.cancel(continuationPoint);
            });

        } else {
            // let extract data from continuation points

            // releaseContinuationPoints = FALSE
            //   passed continuationPoints shall be used to get the next set of
            //   browse information.
            results = request.continuationPoints.map(function (continuationPoint) {
                return session.continuationPointManager.getNext(continuationPoint);
            });
        }

        response = new BrowseNextResponse({
            results: results,
            diagnosticInfos: null
        });
        sendResponse(response);
    });
};

// read services
OPCUAServer.prototype._on_ReadRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof ReadRequest);

    this._apply_on_SessionObject(ReadResponse, message, channel, function (session, sendResponse, sendError) {

        const context = new SessionContext({session, server});

        let response;

        let results = [];

        const timestampsToReturn = request.timestampsToReturn;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return sendError(StatusCodes.BadTimestampsToReturnInvalid);
        }

        if (request.maxAge < 0) {
            return sendError(StatusCodes.BadMaxAgeInvalid);
        }

        request.nodesToRead = request.nodesToRead || [];

        if (!request.nodesToRead || request.nodesToRead.length <= 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        assert(request.nodesToRead[0]._schema.name === "ReadValueId");
        assert(request.timestampsToReturn);

        // limit size of nodesToRead array to maxNodesPerRead
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
            if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        // proceed with registered nodes alias resolution
        for (let i=0;i<request.nodesToRead.length;i++) {
            request.nodesToRead[i].nodeId = session.resolveRegisteredNode(request.nodesToRead[i].nodeId);
        }

        // ask for a refresh of asynchronous variables
        server.engine.refreshValues(request.nodesToRead, function (err) {
            assert(!err, " error not handled here , fix me");

            results = server.engine.read(context, request);

            assert(results[0]._schema.name === "DataValue");
            assert(results.length === request.nodesToRead.length);

            response = new ReadResponse({
                results: null,
                diagnosticInfos: null
            });
            // set it here for performance
            response.results = results;
            assert(response.diagnosticInfos.length === 0);
            sendResponse(response);
        });

    });

};

// read services
OPCUAServer.prototype._on_HistoryReadRequest = function (message, channel) {

    const server = this;
    const request = message.request;

    assert(request instanceof HistoryReadRequest);

    this._apply_on_SessionObject(HistoryReadResponse, message, channel, function (session, sendResponse, sendError) {

        let response;

        const timestampsToReturn = request.timestampsToReturn;

        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return sendError(StatusCodes.BadTimestampsToReturnInvalid);
        }

        if (request.maxAge < 0) {
            return sendError(StatusCodes.BadMaxAgeInvalid);
        }

        request.nodesToRead = request.nodesToRead || [];

        if (!request.nodesToRead || request.nodesToRead.length <= 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        assert(request.nodesToRead[0]._schema.name === "HistoryReadValueId");
        assert(request.timestampsToReturn);

        // limit size of nodesToRead array to maxNodesPerRead
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerRead > 0) {
            if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRead) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }
        // todo : handle
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData > 0) {
            if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents > 0) {
            if (request.nodesToRead.length > server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        const context = new SessionContext({session, server});

        // ask for a refresh of asynchronous variables
        server.engine.refreshValues(request.nodesToRead, function (err) {

            assert(!err, " error not handled here , fix me"); //TODO

            server.engine.historyRead(context, request, function (err, results) {
                assert(results[0]._schema.name === "HistoryReadResult");
                assert(results.length === request.nodesToRead.length);

                response = new HistoryReadResponse({
                    results: results,
                    diagnosticInfos: null
                });

                assert(response.diagnosticInfos.length === 0);
                sendResponse(response);
            });
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

    const server = this;
    const request = message.request;
    assert(request instanceof WriteRequest);
    assert(!request.nodesToWrite || _.isArray(request.nodesToWrite));

    this._apply_on_SessionObject(WriteResponse, message, channel, function (session, sendResponse, sendError) {
        let response;

        if (!request.nodesToWrite || request.nodesToWrite.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        if (server.engine.serverCapabilities.operationLimits.maxNodesPerWrite > 0) {
            if (request.nodesToWrite.length > server.engine.serverCapabilities.operationLimits.maxNodesPerWrite) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        // proceed with registered nodes alias resolution
        for (let i=0;i<request.nodesToWrite.length;i++) {
            request.nodesToWrite[i].nodeId = session.resolveRegisteredNode(request.nodesToWrite[i].nodeId);
        }

        const context = new SessionContext({session, server});

        assert(request.nodesToWrite[0]._schema.name === "WriteValue");
        server.engine.write(context, request.nodesToWrite, function (err, results) {
            assert(!err);
            assert(_.isArray(results));
            assert(results.length === request.nodesToWrite.length);
            response = new WriteResponse({
                results: results,
                diagnosticInfos: null
            });
            sendResponse(response);
        });
    });
};

/*=== private
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
function monitoredItem_read_and_record_value(self, oldValue, node, itemToMonitor, callback) {

    assert(self instanceof MonitoredItem);
    assert(oldValue instanceof DataValue);
    assert(itemToMonitor.attributeId === AttributeIds.Value);

    const dataValue = node.readAttribute(itemToMonitor.attributeId, itemToMonitor.indexRange, itemToMonitor.dataEncoding);

    callback(null, dataValue);
}

/*== private
 * @method monitoredItem_read_and_record_value_async
 * this method applies to Variable Values attribute
 * @param self
 * @param oldValue
 * @param node
 * @param itemToMonitor
 * @private
 */
function monitoredItem_read_and_record_value_async(self, context, oldValue, node, itemToMonitor, callback) {

    assert(context instanceof SessionContext);
    assert(itemToMonitor.attributeId === AttributeIds.Value);
    assert(self instanceof MonitoredItem);
    assert(oldValue instanceof DataValue);
    // do it asynchronously ( this is only valid for value attributes )
    assert(itemToMonitor.attributeId === AttributeIds.Value);

    node.readValueAsync(context, function (err, dataValue) {
        callback(err, dataValue);
    });
}


function build_scanning_node_function(context, addressSpace, monitoredItem, itemToMonitor) {

    //assert(addressSpace instanceof AddressSpace);
    assert(context instanceof SessionContext);
    assert(addressSpace.constructor.name === "AddressSpace");
    assert(itemToMonitor instanceof ReadValueId);

    const node = addressSpace.findNode(itemToMonitor.nodeId);

    /* istanbul ignore next */
    if (!node) {

        console.log(" INVALID NODE ID  , ", itemToMonitor.nodeId.toString());
        dump(itemToMonitor);
        return function (oldData, callback) {
            callback(null, new DataValue({
                statusCode: StatusCodes.BadNodeIdUnknown,
                value: {dataType: DataType.Null, value: 0}
            }));
        };
    }

    /////!!monitoredItem.setNode(node);

    if (itemToMonitor.attributeId === AttributeIds.Value) {

        const monitoredItem_read_and_record_value_func =
            (itemToMonitor.attributeId === AttributeIds.Value && _.isFunction(node.readValueAsync)) ?
                monitoredItem_read_and_record_value_async :
                monitoredItem_read_and_record_value;

        return function (oldDataValue, callback) {
            assert(this instanceof MonitoredItem);
            assert(oldDataValue instanceof DataValue);
            assert(_.isFunction(callback));
            monitoredItem_read_and_record_value_func(this, context, oldDataValue, node, itemToMonitor, callback);
        };


    } else {
        // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
        // The filter is not used for these  Attributes. Any change in value for these  Attributes
        // causes a  Notification  to be  generated.

        // only record value when it has changed
        return function (oldDataValue, callback) {

            const self = this;
            assert(self instanceof MonitoredItem);
            assert(oldDataValue instanceof DataValue);
            assert(_.isFunction(callback));

            const newDataValue = node.readAttribute(itemToMonitor.attributeId);
            callback(null, newDataValue);
        };
    }
}


function prepareMonitoredItem(context, addressSpace, monitoredItem) {
    const itemToMonitor = monitoredItem.itemToMonitor;
    const readNodeFunc = build_scanning_node_function(context, addressSpace, monitoredItem, itemToMonitor);
    monitoredItem.samplingFunc = readNodeFunc;
}


OPCUAServer.MAX_SUBSCRIPTION = 50;

// subscription services
OPCUAServer.prototype._on_CreateSubscriptionRequest = function (message, channel) {

    const server = this;
    const engine = server.engine;
    const addressSpace = engine.addressSpace;

    const request = message.request;
    assert(request instanceof CreateSubscriptionRequest);

    this._apply_on_SessionObject(CreateSubscriptionResponse, message, channel, function (session, sendResponse, sendError) {

        const context = new SessionContext({session, server});

        if (session.currentSubscriptionCount >= OPCUAServer.MAX_SUBSCRIPTION) {
            return sendError(StatusCodes.BadTooManySubscriptions);
        }

        const subscription = session.createSubscription(request);

        subscription.on("monitoredItem", function (monitoredItem) {
            prepareMonitoredItem(context, addressSpace, monitoredItem);
        });

        const response = new CreateSubscriptionResponse({
            subscriptionId: subscription.id,
            revisedPublishingInterval: subscription.publishingInterval,
            revisedLifetimeCount: subscription.lifeTimeCount,
            revisedMaxKeepAliveCount: subscription.maxKeepAliveCount
        });
        sendResponse(response);
    });
};

OPCUAServer.prototype._on_DeleteSubscriptionsRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof DeleteSubscriptionsRequest);
    this._apply_on_SubscriptionIds(DeleteSubscriptionsResponse, message, channel, function (session, subscriptionId) {

        const subscription = server.engine.findOrphanSubscription(subscriptionId);
        if (subscription) {
            return server.engine.deleteOrphanSubscription(subscription);
        }

        return session.deleteSubscription(subscriptionId);
    });
};

OPCUAServer.prototype._on_TransferSubscriptionsRequest = function (message, channel) {

    //
    // sendInitialValue Boolean
    //    A Boolean parameter with the following values:
    //    TRUE      the first Publish response(s) after the TransferSubscriptions call shall
    //              contain the current values of all Monitored Items in the Subscription where
    //              the Monitoring Mode is set to Reporting.
    //    FALSE     the first Publish response after the TransferSubscriptions call shall contain only the value
    //              changes since the last Publish response was sent.
    //    This parameter only applies to MonitoredItems used for monitoring Attribute changes.
    //

    const server = this;
    const engine = server.engine;

    const request = message.request;
    assert(request instanceof TransferSubscriptionsRequest);
    this._apply_on_SubscriptionIds(TransferSubscriptionsResponse, message, channel, function (session, subscriptionId) {
        return engine.transferSubscription(session, subscriptionId, request.sendInitialValues);
    });
};


OPCUAServer.prototype.prepare = function (message, channel) {

    const server = this;
    const request = message.request;

    // --- check that session is correct
    const authenticationToken = request.requestHeader.authenticationToken;
    const session = server.getSession(authenticationToken, /*activeOnly*/true);
    message.session = session;
    if (!session) {
        message.session_statusCode = StatusCodes.BadSessionIdInvalid;
        return;
    }

    //xx console.log("xxxx channel ",channel.secureChannelId,session.secureChannelId);
    // --- check that provided session matches session attached to channel
    if (channel.secureChannelId !== session.secureChannelId) {
        if (!(request instanceof ActivateSessionRequest)) {
            console.log("ERROR: channel.secureChannelId !== session.secureChannelId".red.bgWhite, channel.secureChannelId, session.secureChannelId);
            //xx console.log("trace",(new Error()).stack);
        }
        message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;

    } else if (channel_has_session(channel, session)) {
        message.session_statusCode = StatusCodes.Good;
    } else {
        // session ma y have been moved to a different channel
        message.session_statusCode = StatusCodes.BadSecureChannelIdInvalid;
    }
};


OPCUAServer.prototype._on_CreateMonitoredItemsRequest = function (message, channel) {

    const server = this;
    const engine = server.engine;
    const addressSpace = engine.addressSpace;

    const request = message.request;
    assert(request instanceof CreateMonitoredItemsRequest);


    this._apply_on_Subscription(CreateMonitoredItemsResponse, message, channel, function (session, subscription, sendResponse,sendError) {

        const timestampsToReturn = request.timestampsToReturn;
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return sendError(StatusCodes.BadTimestampsToReturnInvalid);
        }

        if (!request.itemsToCreate || request.itemsToCreate.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }
        if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
            if (request.itemsToCreate.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }


        const results = request.itemsToCreate.map(
            subscription.createMonitoredItem.bind(subscription, addressSpace, timestampsToReturn));

        const response = new CreateMonitoredItemsResponse({
            responseHeader: {serviceResult: StatusCodes.Good},
            results: results
            //,diagnosticInfos: []
        });

        sendResponse(response);

    });

};

const ModifySubscriptionRequest = subscription_service.ModifySubscriptionRequest;
const ModifySubscriptionResponse = subscription_service.ModifySubscriptionResponse;

OPCUAServer.prototype._on_ModifySubscriptionRequest = function (message, channel) {

    const request = message.request;
    assert(request instanceof ModifySubscriptionRequest);

    this._apply_on_Subscription(ModifySubscriptionResponse, message, channel, function (session, subscription, sendResponse, sendError) {

        subscription.modify(request);

        const response = new ModifySubscriptionResponse({
            revisedPublishingInterval: subscription.publishingInterval,
            revisedLifetimeCount: subscription.lifeTimeCount,
            revisedMaxKeepAliveCount: subscription.maxKeepAliveCount
        });

        sendResponse(response);
    });
};


OPCUAServer.prototype._on_ModifyMonitoredItemsRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof ModifyMonitoredItemsRequest);

    this._apply_on_Subscription(ModifyMonitoredItemsResponse, message, channel, function (session, subscription, sendResponse,sendError) {

        const timestampsToReturn = request.timestampsToReturn;
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return sendError(StatusCodes.BadTimestampsToReturnInvalid);
        }

        if (!request.itemsToModify || request.itemsToModify.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }
        if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
            if (request.itemsToModify.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        const itemsToModify = request.itemsToModify; // MonitoredItemModifyRequest

        function modifyMonitoredItem(item) {

            const monitoredItemId = item.monitoredItemId;
            const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
            if (!monitoredItem) {
                return new MonitoredItemModifyResult({statusCode: StatusCodes.BadMonitoredItemIdInvalid});
            }

            // adjust samplingInterval if === -1
            if (item.requestedParameters.samplingInterval === -1) {
                item.requestedParameters.samplingInterval = subscription.publishingInterval;
            }

            return monitoredItem.modify(timestampsToReturn, item.requestedParameters);
        }

        const results = itemsToModify.map(modifyMonitoredItem);

        const response = new ModifyMonitoredItemsResponse({
            results: results
        });
        sendResponse(response);
    });

};

OPCUAServer.prototype._on_PublishRequest = function (message, channel) {

    const request = message.request;
    assert(request instanceof PublishRequest);

    this._apply_on_SessionObject(PublishResponse, message, channel, function (session, sendResponse, sendError) {
        assert(session);
        assert(session.publishEngine); // server.publishEngine doesn't exists, OPCUAServer has probably shut down already
        session.publishEngine._on_PublishRequest(request, function (request, response) {
            sendResponse(response);
        });
    });
};


OPCUAServer.prototype._on_SetPublishingModeRequest = function (message, channel) {

    const request = message.request;
    assert(request instanceof SetPublishingModeRequest);
    const publishingEnabled = request.publishingEnabled;
    this._apply_on_Subscriptions(SetPublishingModeResponse, message, channel, function (session, subscription) {
        return subscription.setPublishingMode(publishingEnabled);
    });
};

OPCUAServer.prototype._on_DeleteMonitoredItemsRequest = function (message, channel) {
    const server = this;
    const request = message.request;
    assert(request instanceof DeleteMonitoredItemsRequest);

    this._apply_on_Subscription(DeleteMonitoredItemsResponse, message, channel, function (session, subscription, sendResponse,sendError) {

        if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }
        if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
            if (request.monitoredItemIds.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }
        const results = request.monitoredItemIds.map(function (monitoredItemId) {
            return subscription.removeMonitoredItem(monitoredItemId);
        });

        const response = new DeleteMonitoredItemsResponse({
            results: results,
            diagnosticInfos: null
        });

        sendResponse(response);
    });
};

OPCUAServer.prototype._on_RepublishRequest = function (message, channel) {

    const request = message.request;
    assert(request instanceof RepublishRequest);

    this._apply_on_Subscription(RepublishResponse, message, channel, function (session, subscription, sendResponse, sendError) {

        // update diagnostic counter
        subscription.subscriptionDiagnostics.republishRequestCount += 1;

        const retransmitSequenceNumber = request.retransmitSequenceNumber;
        const msgSequence = subscription.getMessageForSequenceNumber(retransmitSequenceNumber);

        if (!msgSequence) {
            return sendError(StatusCodes.BadMessageNotAvailable);
        }
        const response = new RepublishResponse({
            responseHeader: {
                serviceResult: StatusCodes.Good
            },
            notificationMessage: msgSequence.notification
        });

        sendResponse(response);
    });
};

const SetMonitoringModeRequest = subscription_service.SetMonitoringModeRequest;
const SetMonitoringModeResponse = subscription_service.SetMonitoringModeResponse;

// Bad_NothingToDo
// Bad_TooManyOperations
// Bad_SubscriptionIdInvalid
// Bad_MonitoringModeInvalid
OPCUAServer.prototype._on_SetMonitoringModeRequest = function (message, channel) {
    const server = this;
    const request = message.request;
    assert(request instanceof SetMonitoringModeRequest);


    this._apply_on_Subscription(SetMonitoringModeResponse, message, channel, function (session, subscription, sendResponse, sendError) {

        if (!request.monitoredItemIds || request.monitoredItemIds.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }
        if (server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall > 0) {
            if (request.monitoredItemIds.length > server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }
        const monitoringMode = request.monitoringMode;

        if (monitoringMode === subscription_service.MonitoringMode.Invalid) {
            return sendError(StatusCodes.BadMonitoringModeInvalid);
        }

        const results = request.monitoredItemIds.map(function (monitoredItemId) {

            const monitoredItem = subscription.getMonitoredItem(monitoredItemId);
            if (!monitoredItem) {
                return StatusCodes.BadMonitoredItemIdInvalid;
            }
            monitoredItem.setMonitoringMode(monitoringMode);
            return StatusCodes.Good;
        });

        const response = new SetMonitoringModeResponse({
            results: results
        });
        sendResponse(response);
    });

};

// _on_TranslateBrowsePathsToNodeIds service
OPCUAServer.prototype._on_TranslateBrowsePathsToNodeIdsRequest = function (message, channel) {

    const request = message.request;
    assert(request instanceof TranslateBrowsePathsToNodeIdsRequest);
    const server = this;


    this._apply_on_SessionObject(TranslateBrowsePathsToNodeIdsResponse, message, channel, function (session,sendResponse, sendError) {

        if (!request.browsePath || request.browsePath.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds > 0) {
            if (request.browsePath.length > server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        const browsePathResults = request.browsePath.map(function (browsePath) {
            return server.engine.browsePath(browsePath);
        });
        const response = new TranslateBrowsePathsToNodeIdsResponse({
            results: browsePathResults,
            diagnosticInfos: null
        });
        sendResponse(response);

    });

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

const getMethodDeclaration_ArgumentList = require("node-opcua-address-space").getMethodDeclaration_ArgumentList;
const verifyArguments_ArgumentList = require("node-opcua-address-space").verifyArguments_ArgumentList;

function callMethod(session, callMethodRequest, callback) {
    /* jshint validthis: true */
    const server = this;
    const addressSpace = server.engine.addressSpace;

    const objectId = callMethodRequest.objectId;
    const methodId = callMethodRequest.methodId;
    const inputArguments = callMethodRequest.inputArguments;

    assert(objectId instanceof NodeId);
    assert(methodId instanceof NodeId);


    let response = getMethodDeclaration_ArgumentList(addressSpace, objectId, methodId);

    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, {statusCode: response.statusCode});
    }
    const methodDeclaration = response.methodDeclaration;

    // verify input Parameters
    const methodInputArguments = methodDeclaration.getInputArguments();

    response = verifyArguments_ArgumentList(addressSpace, methodInputArguments, inputArguments);
    if (response.statusCode !== StatusCodes.Good) {
        return callback(null, response);
    }

    const methodObj = addressSpace.findNode(methodId);

    // invoke method on object
    const context = new SessionContext({
        session: session,
        object: addressSpace.findNode(objectId),
        server: server
    });

    methodObj.execute(inputArguments, context, function (err, callMethodResponse) {

        /* istanbul ignore next */
        if (err) {
            return callback(err);
        }


        callMethodResponse.inputArgumentResults = response.inputArgumentResults || [];
        assert(callMethodResponse.statusCode);


        if (callMethodResponse.statusCode === StatusCodes.Good) {
            assert(_.isArray(callMethodResponse.outputArguments));
        }

        assert(_.isArray(callMethodResponse.inputArgumentResults));
        assert(callMethodResponse.inputArgumentResults.length === methodInputArguments.length);

        return callback(null, callMethodResponse);
    });

}


// Call Service Result Codes
// Symbolic Id Description
// Bad_NothingToDo       See Table 165 for the description of this result code.
// Bad_TooManyOperations See Table 165 for the description of this result code.
//
OPCUAServer.prototype._on_CallRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof CallRequest);

    this._apply_on_SessionObject(CallResponse, message, channel, function (session, sendResponse, sendError) {

        let response;

        if (!request.methodsToCall || request.methodsToCall.length === 0) {
            return sendError(StatusCodes.BadNothingToDo);
        }

        // the MaxNodesPerMethodCall Property indicates the maximum size of the methodsToCall array when
        // a Client calls the Call Service.
        let maxNodesPerMethodCall = server.engine.serverCapabilities.operationLimits.maxNodesPerMethodCall;
        maxNodesPerMethodCall = maxNodesPerMethodCall <= 0 ? 1000 : maxNodesPerMethodCall;
        if (request.methodsToCall.length >= maxNodesPerMethodCall) {
            return sendError(StatusCodes.BadTooManyOperations);
        }


        async.map(request.methodsToCall, callMethod.bind(server, session), function (err, results) {
            if (err) {
                console.log("ERROR in method Call !! ", err);
            }
            assert(_.isArray(results));
            response = new CallResponse({results: results});
            sendResponse(response);
        }, function (err) {
            /* istanbul ignore next */
            if (err) {
                channel.send_error_and_abort(StatusCodes.BadInternalError, err.message, "", function () {
                });
            }
        });
    });
};


OPCUAServer.prototype._on_RegisterNodesRequest = function (message, channel) {
    const server = this;
    const request = message.request;
    assert(request instanceof RegisterNodesRequest);

    this._apply_on_SessionObject(RegisterNodesResponse, message, channel, function (session, sendResponse, sendError) {

        let response;

        if (!request.nodesToRegister || request.nodesToRegister.length === 0) {
            response = new RegisterNodesResponse({responseHeader: {serviceResult: StatusCodes.BadNothingToDo}});
            return sendResponse(response);
        }
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
            if (request.nodesToRegister.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }
        // A list of NodeIds which the Client shall use for subsequent access operations. The
        // size and order of this list matches the size and order of the nodesToRegister
        // request parameter.
        // The Server may return the NodeId from the request or a new (an alias) NodeId. It
        // is recommended that the Server return a numeric NodeIds for aliasing.
        // In case no optimization is supported for a Node, the Server shall return the
        // NodeId from the request.
        const registeredNodeIds = request.nodesToRegister.map(nodeId => session.registerNode(nodeId));

        response = new RegisterNodesResponse({
            registeredNodeIds: registeredNodeIds
        });
        sendResponse(response);
    });
};
OPCUAServer.prototype._on_UnregisterNodesRequest = function (message, channel) {

    const server = this;
    const request = message.request;
    assert(request instanceof UnregisterNodesRequest);

    this._apply_on_SessionObject(UnregisterNodesResponse, message, channel, function (session, sendResponse, sendError) {

        let response;

        if (!request.nodesToUnregister || request.nodesToUnregister.length === 0) {
            response = new UnregisterNodesResponse({responseHeader: {serviceResult: StatusCodes.BadNothingToDo}});
            return sendResponse(response);
        }
        if (server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes > 0) {
            if (request.nodesToRegister.length > server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes) {
                return sendError(StatusCodes.BadTooManyOperations);
            }
        }

        request.nodesToUnregister.map(nodeId => session.unRegisterNode(nodeId));

        response = new UnregisterNodesResponse({});
        sendResponse(response);
    });

};

OPCUAServer.prototype._on_Cancel = function (message, channel) {
    return g_sendError(channel, message, session_service.CancelResponse, StatusCodes.BadNotImplemented);
};


// NodeManagement Service Set Overview
// This Service Set defines Services to add and delete AddressSpace Nodes and References between them. All added
// Nodes continue to exist in the AddressSpace even if the Client that created them disconnects from the Server.
//
const node_managment_service = require("node-opcua-service-node-management");

OPCUAServer.prototype._on_AddNodes = function (message, channel) {
    return g_sendError(channel, message, node_managment_service.AddNodesResponse, StatusCodes.BadNotImplemented);
};

OPCUAServer.prototype._on_AddReferences = function (message, channel) {
    return g_sendError(channel, message, node_managment_service.AddReferencesResponse, StatusCodes.BadNotImplemented);
};
OPCUAServer.prototype._on_DeleteNodes = function (message, channel) {
    return g_sendError(channel, message, node_managment_service.DeleteNodesResponse, StatusCodes.BadNotImplemented);
};
OPCUAServer.prototype._on_DeleteReferences = function (message, channel) {
    return g_sendError(channel, message, node_managment_service.DeleteReferencesResponse, StatusCodes.BadNotImplemented);
};


// Query Service
OPCUAServer.prototype._on_QueryFirst = function (message, channel) {
    return g_sendError(channel, message, query_service.QueryFirstResponse, StatusCodes.BadNotImplemented);
};
OPCUAServer.prototype._on_QueryNext = function (message, channel) {
    return g_sendError(channel, message, query_service.QueryNextResponse, StatusCodes.BadNotImplemented);
};


OPCUAServer.prototype._on_HistoryUpdate = function (message, channel) {
    return g_sendError(channel, message, historizing_service.HistoryUpdateResponse, StatusCodes.BadNotImplemented);
};


/**
 * @method registerServer
 * @async
 * @param discovery_server_endpointUrl
 * @param isOnLine
 * @param outer_callback
 */
OPCUAServer.prototype._registerServer = function (discovery_server_endpointUrl, isOnLine, outer_callback) {


    function findSecureEndpoint(endpoints) {
        let endpoint = endpoints.filter(function (e) {
            return e.securityMode === MessageSecurityMode.SIGNANDENCRYPT;
        });
        if (endpoint.length === 0) {
            endpoint = endpoints.filter(function (e) {
                return e.securityMode === MessageSecurityMode.SIGN;
            });
        }
        if (endpoint.length === 0) {
            endpoint = endpoints.filter(function (e) {
                return e.securityMode === MessageSecurityMode.NONE;
            });
        }
        return endpoint[0];
    }


    const self = this;
    assert(self.serverType, " must have a valid server Type");

    let client = new OPCUAClientBase({
        certificateFile: self.certificateFile,
        privateKeyFile: self.privateKeyFile
    });

    let discoveryServerCertificateChain = null;

    async.series([

        function (callback) {

            client.connect(discovery_server_endpointUrl, callback);

        },
        function (callback) {

            client.getEndpointsRequest(function (err, endpoints) {
                if (!err) {

                    const endpoint = findSecureEndpoint(endpoints);
                    assert(endpoint);
                    if (endpoint.serverCertificate) {
                        assert(endpoint.serverCertificate);
                        discoveryServerCertificateChain = endpoint.serverCertificate;
                    } else {
                        discoveryServerCertificateChain = null;
                    }
                }
                callback(err);
            });
        },

        function (callback) {
            client.disconnect(callback);
        },

        function (callback) {

            if (!discoveryServerCertificateChain) { return callback(); }

            const options = {
                securityMode: MessageSecurityMode.SIGN,
                securityPolicy: SecurityPolicy.Basic128Rsa15,
                serverCertificate: discoveryServerCertificateChain,
                certificateFile: self.certificateFile,
                privateKeyFile: self.privateKeyFile
            };

            client = new OPCUAClientBase(options);

            client.connect(discovery_server_endpointUrl, function (err) {
                if (!err) {
                    callback(err);
                } else {
                    console.log(" cannot register server to discovery server " + discovery_server_endpointUrl);
                    console.log("   " + err.message);
                    console.log(" make sure discovery server is up and running.");
                    client.disconnect(function () {
                        callback(err);
                    });
                }
            });
        },

        function (callback) {
            if (!discoveryServerCertificateChain) { return callback(); }

            const discoveryUrls = self.getDiscoveryUrls();

            const request = new RegisterServerRequest({
                server: {

                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: self.serverInfo.applicationUri,

                    // The globally unique identifier for the Server product.
                    productUri: self.serverInfo.productUri,
                    serverNames: [
                        {locale: "en", text: self.serverInfo.productName}
                    ],
                    serverType: self.serverType,
                    gatewayServerUri: null,
                    discoveryUrls: discoveryUrls,
                    semaphoreFilePath: null,
                    isOnline: isOnLine
                }
            });

            //xx console.log("request",request.toString());

            client.performMessageTransaction(request, function (err, response) {
                if (!err) {
                    // RegisterServerResponse
                    assert(response instanceof RegisterServerResponse);
                }
                callback(err);
            });
        },

        function (callback) {
            if (!discoveryServerCertificateChain) { return callback(); }
            client.disconnect(callback);
        }

    ], function (err) {
        if (err) {
            console.log("error ", err.message);
        }
        outer_callback(err);
    });

};

OPCUAServer.prototype.registerServer = function (discovery_server_endpointUrl, callback) {
    this._registerServer(discovery_server_endpointUrl, true, callback);
};

OPCUAServer.prototype.unregisterServer = function (discovery_server_endpointUrl, callback) {
    this._registerServer(discovery_server_endpointUrl, false, callback);
};

OPCUAServer.prototype.__defineGetter__("isAuditing", function () {
    return this.engine.isAuditing;
});

exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;
