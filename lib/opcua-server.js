var util = require('util');
var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require('better-assert');

var hexDump = require("../lib/utils").hexDump;
var async = require('async');
var messageHeaderToString = require("../lib/packet_analyzer").messageHeaderToString;

var debugLog = require("../lib/utils").make_debugLog(__filename);

var ServerSecureChannelLayer = require("../lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var ServerEngine = require("../lib/server/server_engine").ServerEngine;
var browse_service = require("./browse_service");
var read_service = require("./read_service");

var _ = require("underscore");
var NodeId = require("./nodeid").NodeId;
var NodeIdType = require("./nodeid").NodeIdType;
var crypto = require("crypto");

var OPCUAServerEndPoint = require("./server/server_endpoint").OPCUAServerEndPoint;







function ServerSession(sessionId)
{
    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING,crypto.randomBytes(16));
    this.nodeId = new NodeId(NodeIdType.NUMERIC,sessionId,0);
}



OPCUAServer = function () {


    var self = this;

    self.endpoints = [];

    self.engine = new ServerEngine();

    self.protocolVersion = 1;
    self.connected_client_count = 0;

    // add the tcp/ip endpoint with no security
    var endpoint = new OPCUAServerEndPoint(this, 6543);
    self.endpoints.push(endpoint);

    endpoint.on("message", function(request,channel,endpoint) {
        self.on_request(request,channel,endpoint);
    });

    self.sessions = {};

    self.serverType = s.ApplicationType.SERVER;
};

/**
 * create and register a new session
 * @returns {ServerSession}
 */
OPCUAServer.prototype.createSession = function()
{
    var self = this;

    // create counter if not already done
    if (!self._session_counter) { self._session_counter = 0; }

    var session = new ServerSession(self._session_counter);

    self._session_counter +=1;

    var key = session.authenticationToken.toString();
    self.sessions[key] = session;

    return session;
};

/**
 * retreive a session by authentication token
 *
 * @param authenticationToken
 */
OPCUAServer.prototype.getSession = function(authenticationToken) {

    var self = this;

    if (!authenticationToken || ( authenticationToken.identifierType.value != NodeIdType.BYTESTRING.value))  {
        return null;     // wrong type !
    }
    var key =authenticationToken.toString();
    return self.sessions[key];
};



/**
 * Initiate the server by starting all its endpoints
 */
OPCUAServer.prototype.start = function (done) {

    var tasks = [];

    this.endpoints.forEach(function (endpoint) {
        tasks.push(function (callback) {
            endpoint.start(callback);
        });
    });
    async.parallel(tasks, done);
};

OPCUAServer.prototype.shutdown = function (done) {

    assert(_.isFunction(done));

    var tasks = [];
    this.endpoints.forEach(function (endpoint) {
        tasks.push(function (callback) {
            debugLog(" shutting down endpoint " + endpoint.endpointDescription().endpointUrl);
            endpoint.shutdown(callback);
        });
    });
    async.parallel(tasks, function(err) {
        done(err);
        debugLog("shutdown completed");
    });
};

OPCUAServer.prototype.getCertificate = function () {
    if (!this.certificate) {
        // create fake certificate
        var read_certificate = require("../lib/crypto_utils").read_certificate;
        this.certificate = read_certificate("certificates/cert.pem");
    }
    return this.certificate;
};



OPCUAServer.prototype.on_request = function(request,channel,endpoint) {

    var self = this;
    debugLog("--------------------------------------------------------".green.bold, request._schema.name);
    if (request instanceof s.GetEndpointsRequest) {
        self._on_GetEndpointsRequest(request, channel);

    } else if (request instanceof s.CreateSessionRequest) {
        self._on_CreateSessionRequest(request, channel);

    } else if (request instanceof s.ActivateSessionRequest) {
        self._on_ActivateSessionRequest(request, channel);

    } else if (request instanceof s.CloseSessionRequest) {
        self._on_CloseSessionRequest(request, channel);

    } else if (request instanceof browse_service.BrowseRequest) {
        self._on_Browse(request, channel);

    } else if (request instanceof read_service.ReadRequest) {
        self._on_Read(request, channel);

    } else {
        var errMessage = "UNSUPPORTED REQUEST !! " + request._schema.name;
        debugLog(errMessage.red.bold);
        endpoint._abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported, errMessage, channel);
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
    assert(request._schema.name == "CreateSessionRequest");

    var session = server.createSession();
    assert(session);

    var response = new s.CreateSessionResponse({
        // A identifier which uniquely identifies the session.
        sessionId:  session.nodeId,

        // The token used to authenticate the client in subsequent requests.
        authenticationToken:  session.authenticationToken,

        revisedSessionTimeout: request.requestedSessionTimeout,

        serverNonce: null,

        //The endpoints provided by the server.
        serverEndpoints: null,

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

        // The maximum message size accepted by the server
        maxRequestMessageSize:  0

    });
    assert(response.authenticationToken);
    channel.send_response("MSG", response);
};


OPCUAServer.prototype._on_ActivateSessionRequest = function(request,channel)  {

    var server = this;
    assert(request._schema.name == "ActivateSessionRequest");

    // get the sezssion
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);
    if (!session) {
        console.log(" Bad Session in  _on_ActivateSessionRequest",authenticationToken.value.toString("hex"));
        //xx response = new s.ServiceFault({
        response = new s.ActivateSessionResponse({
            responseHeader: { statusCode: StatusCodes.Bad_SessionNotActivated.value }
        });
    } else {
        response = new s.ActivateSessionResponse({});
    }
    channel.send_response("MSG", response);
};

OPCUAServer.prototype._on_CloseSessionRequest = function(request,channel)  {

    var server = this;
    var response;
    assert(request._schema.name == "CloseSessionRequest");
    var authenticationToken = request.requestHeader.authenticationToken;
    var session = server.getSession(authenticationToken);
    if (!session) {
        console.log(" Bad Session in  _on_CloseSessionRequest");
        response = new s.ServiceFault({
            responseHeader: { statusCode: StatusCodes.Bad_SessionClosed.value}
        });
        assert(response.responseHeader.statusCode == StatusCodes.Bad_SessionClosed.value);
    } else {
        response = new s.CloseSessionResponse({});
    }
    channel.send_response("MSG", response);
};


// browse services
OPCUAServer.prototype._on_Browse = function(browseRequest,channel)  {
    var server = this;
    var engine = server.engine;
    assert(browseRequest._schema.name == "BrowseRequest");
    assert(browseRequest.nodesToBrowse[0]._schema.name == "BrowseDescription");

    var results = engine.browse(browseRequest.nodesToBrowse);
    assert(results[0]._schema.name =="BrowseResult");

    var response = new browse_service.BrowseResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

// read services
OPCUAServer.prototype._on_Read = function(readRequest,channel)  {
    var server = this;
    var engine = server.engine;
    assert(readRequest._schema.name == "ReadRequest");
    assert(readRequest.nodesToRead[0]._schema.name == "ReadValueId");

    var results = engine.read(readRequest.nodesToRead);
    assert(results[0]._schema.name =="DataValue");

    var response = new read_service.ReadResponse({
        results: results,
        diagnosticInfos: null
    });
    channel.send_response("MSG", response);
};

/**
 *
 * @param request
 * @param channel
 * @private
 */
OPCUAServer.prototype._on_GetEndpointsRequest = function (request, channel) {

    var server = this;
    assert(request._schema.name == "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});

    response.endpoints = server.endpoints.map(function (endpoint) {
        return endpoint.endpointDescription();
    });

    channel.send_response("MSG", response);

};


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
            client.performMessageTransaction(request,RegisterServerResponse,function(err,response){
                disconnect(callback);
            });
        } else {
            disconnect(err);

        }
    })
};


exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;



