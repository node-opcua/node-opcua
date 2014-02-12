var net = require('net');
var util = require('util');
var s = require("./structures");
var StatusCodes = require("./opcua_status_code").StatusCodes;
var assert = require("assert");

var hexDump = require("../lib/utils").hexDump;
var async = require('async');
var messageHeaderToString = require("../lib/packet_analyzer").messageHeaderToString;

var debugLog = require("../lib/utils").make_debugLog(__filename);

var ServerSecureChannelLayer = require("../lib/server/server_secure_channel_layer").ServerSecureChannelLayer;
var _ = require("underscore");
/**
 * OPCUAServerEndPoint a ServerEndPoint, listening to one port
 *
 * when a client is connecting, a  SecureChannelIsCreated
 *
 * @param server
 * @param port
 * @constructor
 */
function OPCUAServerEndPoint(server, port) {

    assert(server instanceof OPCUAServer);

    var self = this;
    self.port = parseInt(port);

    self.server = server;
    self._channels = [];

    self._server = net.createServer(

        function (socket) {

            // a client is attempting a connection on the socket

            var channel = new ServerSecureChannelLayer();
            channel.timeout = 100;

            channel.init(socket, function (err) {
                if (err) {
                    socket.end();
                } else {
                    self._registerChannel(channel);
                    debugLog('server receiving a client connection');

                }
            });
            channel.on("message", function (message) {
                debugLog("--------------------------------------------------------".green.bold, message._schema.name);
                if (message instanceof s.GetEndpointsRequest) {
                    self._on_GetEndpointsRequest(message, channel);
                } else if (message instanceof s.CreateSessionRequest) {
                    self._on_CreateSessionRequest(message, channel);
                } else if (message instanceof s.ActivateSessionRequest) {
                    self._on_ActivateSessionRequest(message, channel);
                } else if (message instanceof s.CloseSessionRequest) {
                    self._on_CloseSessionRequest(message, channel);
                } else {
                    var errMessage = "UNSUPPORTED MESSAGE !! " + message._schema.name;
                    debugLog(errMessage.red.bold);
                    self._abortWithError(StatusCodes.Bad_ProtocolVersionUnsupported, errMessage, channel);
                }
            });
            channel.on("abort",function(){
                // the channel has aborted
                self._unregisterChannel(channel);
            });
        }
    );
    self._server.on("connection", function (socket) {
        debugLog('server connected  with : ' + socket.remoteAddress + ':' + socket.remotePort);
    });
}


OPCUAServerEndPoint.prototype.endpointDescription = function () {
    var self = this;

    var server = self.server;
    var hostname = require("os").hostname();

    // return the endpoint object
    var endpoint = new s.EndpointDescription({
        endpointUrl: "opc.tcp://" + hostname + ":" + this.port + "/UA/SampleServer",
        server: {
            applicationUri: "SampleServer",
            productUri: "SampleServer",
            applicationName: { text: "SampleServer", locale: null },
            applicationType: s.EnumApplicationType.SERVER,
            gatewayServerUri: "",
            discoveryProfileUri: "",
            discoveryUrls: []
        },
        serverCertificate: server.getCertificate(),
        securityMode: s.MessageSecurityMode.NONE,
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
        userIdentityTokens: [
            {
                policyId: "0",
                tokenType: s.UserIdentityTokenType.ANONYMOUS,
                issuedTokenType: "",
                issuerEndpointUrl: "",
                securityPolicyUri: ""
            }
        ],
        transportProfileUri: "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary",
        securityLevel: 3
    });

    return endpoint;
};

/**
 *
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._registerChannel = function (channel) {
    var self = this;
    self._channels[channel.securityToken.secureChannelId] = channel;
};

OPCUAServerEndPoint.prototype._unregisterChannel = function (channel) {
    var self = this;
    delete self._channels[channel.securityToken.secureChannelId];
};

OPCUAServerEndPoint.prototype.listen = function () {

    var self = this;
    self._started = true;
    self._server.listen(self.port, function () { //'listening' listener
        debugLog('server bound');
    });
};

OPCUAServerEndPoint.prototype.shutdown = function (callback) {
    var self = this;
    if (self._started) {
        self._started = false;
        self._server.close(function () {
            callback();
        });
    } else {
        callback();
    }
};

OPCUAServerEndPoint.prototype.start = function (callback) {
    this.listen();
    process.nextTick(callback);
};

/**
 *
 * @param statusCode
 * @param description
 * @param channel
 * @private
 */
OPCUAServerEndPoint.prototype._abortWithError = function (statusCode, description, channel) {
    channel.send_error_and_abort(statusCode, description);
};

/**
 *
 * @param request
 * @param channel
 * @private
 */
 OPCUAServerEndPoint.prototype._on_GetEndpointsRequest = function (request, channel) {

    var self = this;
    var server = self.server;
    assert(request._schema.name == "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});

    server.endpoints.forEach(function (endpoint) {
        response.endpoints.push(endpoint.endpointDescription());
    });

    channel.send_response("MSG", response);

};

OPCUAServerEndPoint.prototype._on_CreateSessionRequest = function(request,channel)  {
    var self = this;
    var server = self.server;
    assert(request._schema.name == "CreateSessionRequest");
    var response = new s.CreateSessionResponse({});
    channel.send_response("MSG", response);
};
OPCUAServerEndPoint.prototype._on_ActivateSessionRequest = function(request,channel)  {
    var self = this;
    var server = self.server;
    assert(request._schema.name == "ActivateSessionRequest");
    var response = new s.ActivateSessionResponse({});
    channel.send_response("MSG", response);
};

OPCUAServerEndPoint.prototype._on_CloseSessionRequest = function(request,channel)  {
    var self = this;
    assert(request._schema.name == "CloseSessionRequest");
    var response = new s.CloseSessionResponse({});
    channel.send_response("MSG", response);
};



OPCUAServer = function () {
    var self = this;

    self.endpoints = [];

    self.protocolVersion = 1;
    self.connected_client_count = 0;

    // add the tcp/ip endpoint with no security
    self.endpoints.push(new OPCUAServerEndPoint(this, 65432));

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

exports.OPCUAServerEndPoint = OPCUAServerEndPoint;
exports.OPCUAServer = OPCUAServer;
