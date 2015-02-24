require("requirish")._(module);

var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
var should = require("should");
var util = require("util");
var async = require("async");
var _ = require("underscore");
var assert = require("better-assert");
var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var s = require("lib/datamodel/structures");
var OPCUAServerEndPoint = require("lib/server/server_end_point").OPCUAServerEndPoint;

var register_server_service = require("lib/services/register_server_service");
var RegisterServerRequest  = register_server_service.RegisterServerRequest;
var RegisterServerResponse = register_server_service.RegisterServerResponse;
var FindServersRequest     = register_server_service.FindServersRequest;
var FindServersResponse    = register_server_service.FindServersResponse;

var endpoints_service = require("lib/services/get_endpoints_service");
var ApplicationDescription = endpoints_service.ApplicationDescription;


var OPCUABaseServer = require("lib/server/base_server").OPCUABaseServer;


function OPCUADiscoveryServer(options) {

    var self = this;

    OPCUABaseServer.apply(this,arguments);

    var serverInfo = options.serverInfo || {};

    serverInfo.applicationType     =s.ApplicationType.DISCOVERYSERVER;

    serverInfo.applicationUri      = serverInfo.applicationUri     ||  "urn:NodeOPCUA-Discovery-Server";
    serverInfo.productUri          = serverInfo.productUri         ||  "SampleDiscoveryServer";
    serverInfo.applicationName     = serverInfo.applicationName    ||  {text: "SampleDiscoveryServer", locale: null};
    serverInfo.gatewayServerUri    = serverInfo.gatewayServerUri    || "";
    serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
    serverInfo.discoveryUrls       = serverInfo.discoveryUrls       || [];

    self.serverInfo = serverInfo;

    self.serverType = s.ApplicationType.DISCOVERYSERVER;

    self.registered_servers = [];

    var endPoint = new OPCUAServerEndPoint({
        port: 6543,
        certificate:self.getCertificate(),
        privateKey: self.getPrivateKey(),
        serverInfo: self.serverInfo
    });
    endPoint.addStandardEndpointDescriptions();

    self.endpoints.push(endPoint);

    endPoint.on("message", function(message,channel) {
        self.on_request(message,channel);
    });
}

util.inherits(OPCUADiscoveryServer,OPCUABaseServer);

OPCUADiscoveryServer.prototype.start = function(done) {

    OPCUABaseServer.prototype.start.call(this,done);
};


OPCUADiscoveryServer.prototype.shutdown = OPCUABaseServer.prototype.shutdown;


OPCUADiscoveryServer.prototype.getCertificate = function(){
    return null;
};

OPCUADiscoveryServer.prototype.getPrivateKey = function() {
    return null;
};



OPCUADiscoveryServer.prototype._on_RegisterServerRequest = function (message,channel) {
    var server = this;
    var request = message.request;

    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);

    // BadServerUriInvalid

    // BadServerNameMissing

    if (request.server.discoveryUrls.length === 0 ) {
        // BadDiscoveryUrlMissing
    }
    server.registered_servers.push(request.server);

    var response = new RegisterServerResponse({});
    channel.send_response("MSG", response, message);
};

OPCUADiscoveryServer.prototype._on_FindServersRequest = function (message,channel) {

    var server = this;
    var request = message.request;
    assert(request._schema.name === "FindServersRequest");
    assert(request instanceof FindServersRequest);

    var servers = server.registered_servers.map(function(registered_server){
        return new ApplicationDescription({
            applicationUri: registered_server.serverUri,
            productUri:     registered_server.productUri,
            applicationName: registered_server.serverNames[0], // find one with the expected locale
            applicationType: registered_server.serverType,
            gatewayServerUri: registered_server.gatewayServerUri,
            discoveryProfileUri: registered_server.discoveryUrls[0]
        });

    });

    var response = new FindServersResponse({
        servers: servers
    });
    channel.send_response("MSG", response, message);
};

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;