
var OPCUAServer = require("./opcua_server").OPCUAServer;
var should = require("should");
var util = require("util");
var async = require("async");
var _ = require("underscore");
var assert = require('better-assert');
var debugLog = require("../misc/utils").make_debugLog(__filename);

var s = require("./../datamodel/structures");
var OPCUAServerEndPoint = require("./server_end_point").OPCUAServerEndPoint;
var RegisterServerRequest  = require("./../services/register_server_service").RegisterServerRequest;
var RegisterServerResponse = require("./../services/register_server_service").RegisterServerResponse;
var FindServersRequest = require("./../services/register_server_service").FindServersRequest;
var FindServersResponse = require("./../services/register_server_service").FindServersResponse;

var OPCUABaseServer = require("./base_server").OPCUABaseServer;


function OPCUADiscoveryServer(options) {

    OPCUABaseServer.apply(this,arguments);

    var self = this;
    self.serverType = s.ApplicationType.DISCOVERYSERVER;

    self.registered_servers = [];


    var endPoint = new OPCUAServerEndPoint(this, 6543);

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
        return new s.ApplicationDescription({
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