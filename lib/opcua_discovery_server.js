
var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var should = require("should");
var util = require("util");
var async = require("async");
var _ = require("underscore");
var assert = require('better-assert');
var debugLog = require("../lib/utils").make_debugLog(__filename);

var s = require("../lib/structures");
var OPCUAServerEndPoint = require("../lib/server/server_endpoint").OPCUAServerEndPoint;
var RegisterServerRequest  = require("../lib/register_server_service").RegisterServerRequest;
var RegisterServerResponse = require("../lib/register_server_service").RegisterServerResponse;
var FindServersRequest = require("../lib/register_server_service").FindServersRequest;
var FindServersResponse = require("../lib/register_server_service").FindServersResponse;


function OPCUADiscoveryServer(options) {

    var self = this;
    self.serverType = s.ApplicationType.DISCOVERYSERVER;

    self.registered_servers = [];

    self.endpoints = [];

    var endpoint = new OPCUAServerEndPoint(this, 6543);
    self.endpoints.push(endpoint);

    endpoint.on("message", function(request,channel,endpoint) {
        self.on_request(request,channel,endpoint);
    })

}
//xx util.inherits(OPCUADiscoveryServer,EventEmmitter);

OPCUADiscoveryServer.prototype.start = function (done) {
    var tasks = [];

    this.endpoints.forEach(function (endpoint) {
        tasks.push(function (callback) {
            endpoint.start(callback);
        });
    });
    async.parallel(tasks, done);
};


OPCUADiscoveryServer.prototype.shutdown = function (done) {

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




OPCUADiscoveryServer.prototype.getCertificate = function(){
    return null;
};

OPCUADiscoveryServer.prototype.on_request = function (request,channel,endpoint) {
    var self = this;
    if (request instanceof s.GetEndpointsRequest) {
        self._on_GetEndpointsRequest(request, channel);
    } else  if (request instanceof RegisterServerRequest) {
        self._on_RegisterServerRequest(request,channel);
    } else  if (request instanceof FindServersRequest) {
        self._on_FindServersRequest(request,channel);
    } else {
        var response = new s.ServiceFault({});
        channel.send_response("MSG", response);
    }
};

OPCUADiscoveryServer.prototype._on_GetEndpointsRequest = function (request,channel,endpoint) {

    //xx OPCUAServer.prototype._on_GetEndpointsRequest.apply(this,arguments);
    var server = this;
    assert(request._schema.name === "GetEndpointsRequest");

    var response = new s.GetEndpointsResponse({});
    response.endpoints = server.endpoints.map(function (endpoint) {
        return endpoint.endpointDescription();
    });
    assert( response.endpoints.length>=1);
    channel.send_response("MSG", response);

};

OPCUADiscoveryServer.prototype._on_RegisterServerRequest = function (request,channel,endpoint) {
    var server = this;
    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);

    // Bad_ServerUriInvalid

    // Bad_ServerNameMissing

    if (request.server.discoveryUrls.length ==0 ) {
        // Bad_DiscoveryUrlMissing
    }
    server.registered_servers.push(request.server);

    var response = new RegisterServerResponse({});
    channel.send_response("MSG", response);
};

OPCUADiscoveryServer.prototype._on_FindServersRequest = function (request,channel,endpoint) {

    var server = this;
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
    channel.send_response("MSG", response);
};

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;