"use strict";
const util = require("util");
const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");

const OPCUABaseServer = require("node-opcua-server").OPCUABaseServer;
const OPCUAServerEndPoint = require("node-opcua-server").OPCUAServerEndPoint;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const register_server_service = require("node-opcua-service-register-server");
const RegisterServerRequest = register_server_service.RegisterServerRequest;
const RegisterServerResponse = register_server_service.RegisterServerResponse;

const endpoints_service = require("node-opcua-service-endpoints");
const ApplicationType = endpoints_service.ApplicationType;

const get_fully_qualified_domain_name = require("node-opcua-hostname").get_fully_qualified_domain_name;

function constructFilename(p) {
    const filename = path.join(__dirname, "..", p);
    //xx console.log("fi = ",filename);
    return filename;
}

const makeApplicationUrn = require("node-opcua-common").makeApplicationUrn;

function OPCUADiscoveryServer(options) {

    const self = this;

    const default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;
    assert(fs.existsSync(options.certificateFile));

    const default_private_key_file = constructFilename("certificates/PKI/own/private/private_key.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;
    assert(fs.existsSync(options.certificateFile));

    const defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");

    OPCUABaseServer.apply(this, arguments);

    const serverInfo = options.serverInfo || {};

    serverInfo.applicationType = ApplicationType.DISCOVERYSERVER;
    serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;
    serverInfo.productUri = serverInfo.productUri || "SampleDiscoveryServer";
    serverInfo.applicationName = serverInfo.applicationName || {text: "SampleDiscoveryServer", locale: null};
    serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
    serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
    serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

    self.serverInfo = serverInfo;

    const port = options.port || 4840;

    self.registered_servers = {};
    // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
    // opc.tcp://localhost:4840/UADiscovery

    const endPoint = new OPCUAServerEndPoint({
        port: port,
        certificateChain: self.getCertificateChain(),
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
    const server = this;
    const request = message.request;

    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);

    function sendError(statusCode) {
        ///Xx xconsole.log("_on_RegisterServerRequest error".red, statusCode.toString());
        const response = new RegisterServerResponse({responseHeader: {serviceResult: statusCode}});
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

    const key = request.server.serverUri;

    if (request.server.isOnline) {
        //xx console.log(" registering server : ".cyan, request.server.serverUri.yellow);
        server.registered_servers[key] = request.server;

        // prepare serverInfo which will be used by FindServers
        const serverInfo = {};
        serverInfo.applicationUri = request.server.serverUri;
        serverInfo.applicationType = request.server.serverType;
        serverInfo.productUri = request.server.productUri;
        serverInfo.applicationName = request.server.serverNames[0]; // which one shall we use ?
        serverInfo.gatewayServerUri = request.server.gatewayServerUri;
        // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
        serverInfo.discoveryUrls = request.server.discoveryUrls;
        server.registered_servers[key].serverInfo = serverInfo;

    } else {
        if (key in server.registered_servers) {
            //xx console.log(" unregistering server : ".cyan, request.server.serverUri.yellow);
            delete server.registered_servers[key];
        }
    }

    const response = new RegisterServerResponse({});
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
    const self = this;
    self.serverInfo.discoveryUrls = self.getDiscoveryUrls(channel);
    const servers = [self.serverInfo];
    _.forEach(self.registered_servers, function (registered_server) {
        servers.push(registered_server.serverInfo);
    });

    return servers;
};

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
