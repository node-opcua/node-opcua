"use strict";
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
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var register_server_service = require("lib/services/register_server_service");
var RegisterServerRequest = register_server_service.RegisterServerRequest;
var RegisterServerResponse = register_server_service.RegisterServerResponse;
var FindServersRequest = register_server_service.FindServersRequest;
var FindServersResponse = register_server_service.FindServersResponse;

var endpoints_service = require("lib/services/get_endpoints_service");
var ApplicationDescription = endpoints_service.ApplicationDescription;
var ApplicationType = endpoints_service.ApplicationType;

var get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;
var constructFilename = require("lib/misc/utils").constructFilename;
var OPCUABaseServer = require("lib/server/base_server").OPCUABaseServer;

var makeApplicationUrn = require("lib/misc/applicationurn").makeApplicationUrn;

function OPCUADiscoveryServer(options) {

    var self = this;

    var default_certificate_file = constructFilename("certificates/discoveryServer_cert_1024.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    var default_private_key_file = constructFilename("certificates/discoveryServer_key_1024.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    var defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");

    OPCUABaseServer.apply(this, arguments);

    var serverInfo = options.serverInfo || {};

    serverInfo.applicationType = s.ApplicationType.DISCOVERYSERVER;
    serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;
    serverInfo.productUri = serverInfo.productUri || "SampleDiscoveryServer";
    serverInfo.applicationName = serverInfo.applicationName || {text: "SampleDiscoveryServer", locale: null};
    serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
    serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
    serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

    self.serverInfo = serverInfo;

    var port = options.port || 4840;

    self.registered_servers = {};
    // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
    // opc.tcp://localhost:4840/UADiscovery

    var endPoint = new OPCUAServerEndPoint({
        port: port,
        certificate: self.getCertificate(),
        privateKey: self.getPrivateKey(),
        serverInfo: self.serverInfo
    });
    endPoint.addStandardEndpointDescriptions();

    self.endpoints.push(endPoint);

    endPoint.on("message", function (message, channel) {
        self.on_request(message, channel);
    });
}

util.inherits(OPCUADiscoveryServer, OPCUABaseServer);

OPCUADiscoveryServer.prototype.start = function (done) {
    OPCUABaseServer.prototype.start.call(this, done);
};


OPCUADiscoveryServer.prototype.shutdown = OPCUABaseServer.prototype.shutdown;

/*== private
 * returns true if the serverType can be added to a discovery server.
 * @param serverType
 * @return {boolean}
 * @private
 */
function _isValideServerType(serverType) {

    switch (serverType) {
        case ApplicationType.CLIENT:
            return false;
        case ApplicationType.SERVER:
        case ApplicationType.CLIENTANDSERVER:
        case ApplicationType.DISCOVERYSERVER:
            return true;
    }
    return false;
}

OPCUADiscoveryServer.prototype._on_RegisterServerRequest = function (message, channel) {
    var server = this;
    var request = message.request;

    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);

    function sendError(statusCode) {
        console.log("_on_RegisterServerRequest error".red, statusCode.toString());
        var response = new RegisterServerResponse({responseHeader: {serviceResult: statusCode}});
        return channel.send_response("MSG", response, message);
    }

    // check serverType is valid
    if (!_isValideServerType(request.server.serverType)) {
        return sendError(StatusCodes.BadInvalidArgument);
    }

    // BadServerUriInvalid
    // TODO

    // BadServerNameMissing
    if (request.server.serverNames.length === 0) {
        return sendError(StatusCodes.BadServerNameMissing);
    }

    // BadDiscoveryUrlMissing
    if (request.server.discoveryUrls.length === 0) {
        return sendError(StatusCodes.BadDiscoveryUrlMissing);
    }

    var key = request.server.serverUri;

    if (request.server.isOnline) {
        console.log(" registering server : ".cyan, request.server.serverUri.yellow);
        server.registered_servers[key] = request.server;

        // prepare serverInfo which will be used by FindServers
        var serverInfo = {};
        serverInfo.applicationUri = serverInfo.serverUri;
        serverInfo.applicationType = request.server.serverType;
        serverInfo.productUri = request.server.productUri;
        serverInfo.applicationName = request.server.serverNames[0]; // which one shall we use ?
        serverInfo.gatewayServerUri = request.server.gatewayServerUri;
        // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
        serverInfo.discoveryUrls = request.server.discoveryUrls;
        server.registered_servers[key].serverInfo = serverInfo;

    } else {
        if (key in server.registered_servers) {
            console.log(" unregistering server : ".cyan, request.server.serverUri.yellow);
            delete server.registered_servers[key];
        }
    }

    var response = new RegisterServerResponse({});
    channel.send_response("MSG", response, message);
};

OPCUADiscoveryServer.prototype.__defineGetter__("registeredServerCount", function () {
    return Object.keys(this.registered_servers).length;
});

//OPCUADiscoveryServer.prototype.getDiscoveryUrls = function(channel) {
//
//    var self = this;
//    assert(channel);
//
//    var discoveryUrls = OPCUABaseServer.prototype.getDiscoveryUrls.call(this,channel);
//    // add registered server Urls
//    _.forEach(self.registered_servers,function(registered_server){
//        discoveryUrls = discoveryUrls.concat(registered_server.discoveryUrls);
//    });
//    return discoveryUrls;
//};

OPCUADiscoveryServer.prototype.getServers = function (channel) {
    var self = this;
    self.serverInfo.discoveryUrls = self.getDiscoveryUrls(channel);
    var servers = [self.serverInfo];
    _.forEach(self.registered_servers, function (registered_server) {
        servers.push(registered_server.serverInfo);
    });

    return servers;
};

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
