var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require('better-assert');

var async = require('async');
var util = require("util");
var debugLog = require("../lib/utils").make_debugLog(__filename);

var ServerEngine = require("../lib/server/server_engine").ServerEngine;
var browse_service = require("./browse_service");
var read_service = require("./read_service");
var write_service = require("./write_service");
var subscription_service = require("./subscription_service");
var translate_service = require("../lib/translate_browse_paths_to_node_ids_service");

var ActivateSessionResponse = require("./session_service").ActivateSessionResponse;
var CreateSessionResponse = require("./session_service").CreateSessionResponse;

var _ = require("underscore");
var NodeId = require("./nodeid").NodeId;
var NodeIdType = require("./nodeid").NodeIdType;
var crypto = require("crypto");

var OPCUAServerEndPoint = require("./server/server_endpoint").OPCUAServerEndPoint;

var OPCUABaseServer = require("../lib/server/base_server").OPCUABaseServer;

function OPCUAServer(options) {

    options = options || {};

    OPCUABaseServer.apply(this,arguments);

    var self = this;

    self.options = options;

    self.engine = new ServerEngine();

    self.nonce = crypto.randomBytes(32);

    self.protocolVersion = 1;
    self.connected_client_count = 0;

    var port = options.port || 26543;

    // add the tcp/ip endpoint with no security
    var endpoint = new OPCUAServerEndPoint(this, port , {
        defaultSecureTokenLiveTime: options.defaultSecureTokenLiveTime || 60000
    });
    self.endpoints.push(endpoint);

    endpoint.on("message", function(request,channel,endpoint) {
        self.on_request(request,channel);
    });

    self.serverType = s.ApplicationType.SERVER;
}
util.inherits(OPCUAServer,OPCUABaseServer);

/**
 * create and register a new session
 * @returns {ServerSession}
 */
OPCUAServer.prototype.createSession = function() {
    var self = this;
    return self.engine.createSession();
};

/**
 * retrieve a session by authentication token
 *
 * @param authenticationToken
 */
OPCUAServer.prototype.getSession = function(authenticationToken) {
    var self = this;
    return self.engine.getSession(authenticationToken);
};



/**
 * Initiate the server by starting all its endpoints
 */
OPCUAServer.prototype.start = function (done) {

    var self = this;
    self.engine.initialize(self.options,function() {
       OPCUABaseServer.prototype.start.call(self,done);
    });
};

OPCUAServer.prototype.shutdown = OPCUABaseServer.prototype.shutdown;

OPCUAServer.prototype.getCertificate = function () {
    if (!this.certificate) {
        // create fake certificate
        var read_certificate = require("../lib/crypto_utils").read_certificate;
        this.certificate = read_certificate("certificates/cert.pem");
    }
    return this.certificate;
};



this.request_handlers = {
    "GetEndpointsRequest": this._on_GetEndpointsRequest,
    "CreateSessionRequest": this._on_CreateSessionRequest,
    "ActivateSessionRequest": this._on_ActivateSessionRequest,
    "CloseSessionRequest": this._on_CloseSessionRequest,
    "ActivateSessionRequest": this._on_ActivateSessionRequest
};

/**
 *  construct a service Fault response
 *
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode,messages) {
    var response = new s.ServiceFault();
    response.responseHeader.serviceResult =statusCode;

    //xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    response.responseHeader.stringTable.push.apply(response.responseHeader.stringTable,messages);
    return response;
}
OPCUAServer.prototype.on_request = function(request,channel) {

    var self = this;
    debugLog("--------------------------------------------------------".green.bold, request._schema.name);
    var errMessage,response;

    try {
        // handler must be named _on_ActionRequest()
        var handler = self["_on_"+request._schema.name];
        if (_.isFunction(handler)){
            handler.apply(self,arguments);
        } else {
            errMessage = "UNSUPPORTED REQUEST !! " + request._schema.name;
            debugLog(errMessage.red.bold);
            response = makeServiceFault(StatusCodes.Bad_NotImplemented,[errMessage]);
            channel.send_response("MSG", response);
        }

    } catch(err) {

        errMessage = "EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request._schema.name;
        debugLog(errMessage.red.bold);
        //xx endpoint._abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported, errMessage, channel);

        var additional_messages = [];
        additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ");
        additional_messages.push(err.message);
        additional_messages.push.apply(additional_messages,err.stack.split("\n"));

        response = makeServiceFault(StatusCodes.Bad_NotImplemented,additional_messages);

        channel.send_response("MSG", response);

    }

};

OPCUAServer.prototype.getSignedCertificate = function() {

    var self = this;
    return new s.SignedSoftwareCertificate({
        certificateData: self.getCertificate(),
        signature: new Buffer("HelloWorld")
    });
};

// session services
OPCUAServer.prototype._on_CreateSessionRequest = function(request,channel)  {

    var server = this;
    assert(request._schema.name === "CreateSessionRequest");

    var session = server.createSession();
    assert(session);

    var response = new CreateSessionResponse({
        // A identifier which uniquely identifies the session.
        sessionId:  session.nodeId,

        // The token used to authenticate the client in subsequent requests.
        authenticationToken:  session.authenticationToken,

        revisedSessionTimeout: request.requestedSessionTimeout,

        serverNonce: server.nonce,

        serverCertificate:  server.getCertificate(),

        //The endpoints provided by the server.
        serverEndpoints: server._get_endpoints(),


        serverSoftwareCertificates: null,
        serverSignature: null,
/*
        // SignedSoftwareCertificate: The software certificates owned by the server.
        serverSoftwareCertificates: [
            server.getSignedCertificate()
        ],

        // SignatureData : A signature created with the server certificate.
        //
        // This is a signature generated with the private key associated with the
        // serverCertificate. This parameter is calculated by appending the clientNonceto the
        // clientCertificateand signing the resulting sequence of bytes.
        // The SignatureAlgorithmshall be the asymmetricSignaturealgorithm specified in the
        // SecurityPolicyfor the Endpoint
        serverSignature: null,
*/
        // The maximum message size accepted by the server
        maxRequestMessageSize:  0x4000000

    });
    assert(response.authenticationToken);
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_ActivateSessionRequest = function(request,channel)  {

    var server = this;
    assert(request._schema.name === "ActivateSessionRequest");

    // get session from authenticationToken
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);

    var response;
    if (!session) {
        console.log(" Bad Session in  _on_ActivateSessionRequest".yellow.bold,authenticationToken.value.toString("hex"));

        //xx response = new s.ServiceFault({
        response = new ActivateSessionResponse({
            responseHeader: { serviceResult: StatusCodes.Bad_SessionNotActivated }
        });
    } else {
        response = new ActivateSessionResponse({
            serverNonce: server.nonce
        });
    }
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_CloseSessionRequest = function(request,channel)  {

    var server = this;
    var response;
    assert(request._schema.name === "CloseSessionRequest");
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);
    if (!session) {
        console.log("severs.sessions = ",Object(server.sessions).keys());
        console.log(" Bad Session in  _on_CloseSessionRequest");
        response = new s.ServiceFault({
            responseHeader: { serviceResult: StatusCodes.Bad_SessionClosed}
        });
    } else {
        response = new s.CloseSessionResponse({});
    }
    channel.send_response("MSG", response);
};

// browse services
OPCUAServer.prototype._on_BrowseRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "BrowseRequest");
    assert(request.nodesToBrowse[0]._schema.name === "BrowseDescription");

    var results = engine.browse(request.nodesToBrowse);
    assert(results[0]._schema.name =="BrowseResult");

    var response = new browse_service.BrowseResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

// read services
OPCUAServer.prototype._on_ReadRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "ReadRequest");
    assert(request.nodesToRead[0]._schema.name === "ReadValueId");
    assert(request.timestampsToReturn);

    var results = engine.read(request);

    assert(results[0]._schema.name === "DataValue");

    var response = new read_service.ReadResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

// write services
OPCUAServer.prototype._on_WriteRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "WriteRequest");
    assert(_.isArray(request.nodesToWrite));
    assert(request.nodesToWrite.length>0);
    assert(request.nodesToWrite[0]._schema.name === "WriteValue");

    var results = engine.write(request.nodesToWrite);

    assert(_.isArray(results));
    assert(results.length === request.nodesToWrite.length);

    var response = new write_service.WriteResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

// subscription services
OPCUAServer.prototype._on_CreateSubscriptionRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "CreateSubscriptionRequest");

    var subscription = engine.createSubscription();

    var response = new subscription_service.CreateSubscriptionResponse({
        subscriptionId: subscription.id,
        revisedPublishingInterval: request.requestedPublishingInterval,
        revisedLifetimeCount:      request.requestedLifetimeCount,
        revisedMaxKeepAliveCount:  request.requestedMaxKeepAliveCount
    });
    channel.send_response("MSG", response);
};

// write services
OPCUAServer.prototype._on_DeleteSubscriptionsRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "DeleteSubscriptionsRequest");

    var results =request.subscriptionIds.map(function(subscriptionId){
       return engine.deleteSubscription(subscriptionId);
    })

    var response = new subscription_service.DeleteSubscriptionsResponse({
        results: results
    });
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_CreateMonitoredItemsRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "CreateMonitoredItemsRequest");

    var subscription = engine.getSubscription(request.subscriptionId);
    var response;
    if (!subscription) {
        response = new subscription_service.CreateMonitoredItemsResponse({
            responseHeader : { serviceResult: StatusCodes.Bad_SubscriptionIdInvalid  }
        });
    } else {
        // var itemsToCreate = request.itemsToCreate;

        response = new subscription_service.CreateMonitoredItemsResponse({
            responseHeader : {},
            diagnosticInfos: null
        });
    }
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_PublishRequest = function (request, channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "PublishRequest");

    var subscription = engine.getSubscription(request.subscriptionId);
    var response;
    if (!subscription) {
        response = new subscription_service.PublishResponse({
            responseHeader : { serviceResult: StatusCodes.Bad_SubscriptionIdInvalid }
        });
    } else {
        // var itemsToCreate = request.itemsToCreate;

        response = new subscription_service.PublishResponse({
            results : [],
            diagnosticInfos: null
        });
    }
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_SetPublishingModeRequest = function(request,channel)  {
    var server = this;
    assert(request._schema.name === "SetPublishingModeRequest");
    var response;

    response = new subscription_service.SetPublishingModeResponse({
        results : [],
        diagnosticInfos: null
    });

    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_DeleteMonitoredItemsRequest = function(request,channel)  {
    var server = this;
    assert(request._schema.name === "DeleteMonitoredItemsRequest");

    var response;
    response = new subscription_service.DeleteMonitoredItemsResponse({
        results : [],
        diagnosticInfos: null
    });

    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_RepublishRequest = function(request,channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "RepublishRequest");

    var response;

    var subscription = engine.getSubscription(request.subscriptionId);

    if (!subscription) {
        response = new subscription_service.RepublishResponse({
            responseHeader : {
                serviceResult: StatusCodes.Bad_SubscriptionIdInvalid
            }
        });

    } else {
        response = new subscription_service.RepublishResponse({
            notificationMessage : {
            }
        });
    }
    channel.send_response("MSG", response);
};
OPCUAServer.prototype._on_TranslateBrowsePathsToNodeIdsRequest = function(request,channel)  {
    var server = this;
    var engine = server.engine;
    assert(request._schema.name === "TranslateBrowsePathsToNodeIdsRequest");

    var browsePathResults = request.browsePath.map(function(browsePath){
        return engine.browsePath(browsePath);
    });
    var  response = new translate_service.TranslateBrowsePathsToNodeIdsResponse({
        results : browsePathResults,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._get_endpoints = function() {
    return this.endpoints.map(function (endpoint) {
        return endpoint.endpointDescription();
    });
};
/**
 *
 * @param request
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_GetEndpointsRequest = function (request, channel) {

    var server = this;
    assert(request._schema.name === "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});

    response.endpoints = server._get_endpoints();

    channel.send_response("MSG", response);

};


/**
 *
 * @param discovery_server_endpointUrl
 * @param callback
 */
OPCUAServer.prototype.registerServer = function (discovery_server_endpointUrl,callback) {


    var OPCUAClientBase = require("../lib/client/client_base").OPCUAClientBase;

    var RegisterServerRequest  = require("../lib/register_server_service").RegisterServerRequest;
    var RegisterServerResponse = require("../lib/register_server_service").RegisterServerResponse;

    var self = this;
    assert(self.serverType, " must have a valid server Type");

    var client = new OPCUAClientBase();
    function disconnect(callback) {
        client.disconnect(callback);
    }
    client.connect(discovery_server_endpointUrl,function(err){
        if (!err) {

            var request = new RegisterServerRequest({
                server: {
                    serverUri: "request.serverUri",
                    productUri: "request.productUri",
                    serverNames: [ { locale: "en", text: "MyServerName"}],
                    serverType: self.serverType,
                    gatewayServerUri: null,
                    discoveryUrls: [
                    ],
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });
            assert(request.requestHeader);
            client.performMessageTransaction(request,function(err,response){
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
    })
};


exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;



