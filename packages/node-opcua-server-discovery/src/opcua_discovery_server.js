"use strict";
const util = require("util");
const _ = require("underscore");
const assert = require("node-opcua-assert").assert;
const path = require("path");
const fs = require("fs");
const url = require("url");

const OPCUABaseServer = require("node-opcua-server").OPCUABaseServer;
const OPCUAServerEndPoint = require("node-opcua-server").OPCUAServerEndPoint;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const discovery_service = require("node-opcua-service-discovery");
const RegisterServerRequest = discovery_service.RegisterServerRequest;
const RegisterServerResponse = discovery_service.RegisterServerResponse;
const RegisterServer2Request = discovery_service.RegisterServer2Request;
const RegisterServer2Response = discovery_service.RegisterServer2Response;
const FindServersOnNetworkRequest = discovery_service.FindServersOnNetworkRequest;
const FindServersOnNetworkResponse = discovery_service.FindServersOnNetworkResponse;

const endpoints_service = require("node-opcua-service-endpoints");
const ApplicationType = endpoints_service.ApplicationType;

const get_fully_qualified_domain_name = require("node-opcua-hostname").get_fully_qualified_domain_name;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = false;

const _announcedOnMulticastSubnet = require("node-opcua-service-discovery")._announcedOnMulticastSubnet;
const _stop_announcedOnMulticastSubnet = require("node-opcua-service-discovery")._stop_announcedOnMulticastSubnet;
const _announceServerOnMulticastSubnet = require("node-opcua-service-discovery")._announceServerOnMulticastSubnet;


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

    self.capabilitiesForMDNS = ["LDS"];
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
    self.mDnsResponder = null;
}

util.inherits(OPCUADiscoveryServer, OPCUABaseServer);


OPCUADiscoveryServer.prototype.start = function (done) {
    const self = this;
    assert(self.mDnsResponder === null);
    assert(_.isArray(self.capabilitiesForMDNS));

    OPCUABaseServer.prototype.start.call(this, function (err) {
        if (!err) {
            // declare server in bonjour
            _announcedOnMulticastSubnet.call(self, {
                applicationUri: self.serverInfo.applicationUri,
                port: self.endpoints[0].port,
                path: "/DiscoveryServer",
                capabilities: self.capabilitiesForMDNS
            });
            //
            self.mDnsResponder = new MDNSResponser();

        }
        done(err);
    });
};

OPCUADiscoveryServer.prototype.shutdown = function (done) {
    const self = this;
    _stop_announcedOnMulticastSubnet.call(self);
    if (self.mDnsResponder) {
        self.mDnsResponder.dispose();
        self.mDnsResponder = null;
    }
    OPCUABaseServer.prototype.shutdown.call(this, done);
};

/*== private
 * returns true if the serverType can be added to a discovery server.
 * @param serverType
 * @return {boolean}
 * @private
 */
function _isValidServerType(serverType) {

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


function __internalRegisterServer(RegisterServerXResponse, self, server, discoveryConfiguration) {

    function sendError(statusCode) {
        ///Xx xconsole.log("_on_RegisterServerRequest error".red, statusCode.toString());
        const response = new RegisterServerXResponse({responseHeader: {serviceResult: statusCode}});
        return response;
    }

    // check serverType is valid
    if (!_isValidServerType(server.serverType)) {
        return sendError(StatusCodes.BadInvalidArgument);
    }

    // BadServerUriInvalid
    // TODO

    // BadServerNameMissing
    if (server.serverNames.length === 0) {
        return sendError(StatusCodes.BadServerNameMissing);
    }

    // BadDiscoveryUrlMissing
    if (server.discoveryUrls.length === 0) {
        return sendError(StatusCodes.BadDiscoveryUrlMissing);
    }

    const key = server.serverUri;
    if (server.isOnline) {
        debugLog(" registering server : ".cyan, server.serverUri.yellow);
        self.registered_servers[key] = server;

        // prepare serverInfo which will be used by FindServers
        const serverInfo = {
            applicationUri: server.serverUri,
            productUri: server.productUri,
            applicationType: server.serverType,
            applicationName: server.serverNames[0],  // which one shall we use ?
            gatewayServerUri: server.gatewayServerUri,
            // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
            discoveryUrls: server.discoveryUrls,

        };
        //xx server.semaphoreFilePath = server.semaphoreFilePath;
        //xx server.serverNames = server.serverNames;
        server.serverInfo = serverInfo;
        server.discoveryConfiguration = discoveryConfiguration;


        if (discoveryConfiguration) {

            const endpointUrl = serverInfo.discoveryUrls[0];
            const parsedUrl = url.parse(endpointUrl);

            const options ={
                applicationUri: serverInfo.applicationUri,
                port: parseInt(parsedUrl.port,10),
                path: parsedUrl.pathname || "/",
                capabilities: server.discoveryConfiguration.serverCapabilities || [ "DA" ]
            };
            // let's announce the server on the  mutlicast DNS
            server.bonjourEntry = _announceServerOnMulticastSubnet(self.bonjour, options);
        }

    } else {
        if (key in self.registered_servers) {
            const server  = self.registered_servers[key];
            debugLog("unregistering server : ".cyan, server.serverUri.yellow);
            if (server.bonjourEntry) {
                server.bonjourEntry.stop();
                server.bonjourEntry = null;
            }
            delete self.registered_servers[key];
        }

    }

    const response = new RegisterServerXResponse({});
    response.configurationResults = null;

    return response;
}

OPCUADiscoveryServer.prototype._announcedServerOnTheMulticastSubnet = function () {


};

function MDNSResponser() {

    const self = this;

    self.registeredServers = [];

    self.bonjour = discovery_service.acquireBonjour();
    self.recordId = 0;

    self.responser = self.bonjour.find({
        type: "opcua-tcp",
        protocol: "tcp"
    });

    function addService(service) {
        if (doDebug) {
            debugLog(service);
        }
        // example:
        // {
        //     addresses: [ '172.18.207.145', 'fe80::d4e3:352c:9f8b:d0db' ],
        //     rawTxt: <Buffer 05 70 61 74 68 3d 08 63 61 70 73 3d 4c 44 53>,
        //     txt: { path: '', caps: 'LDS' },
        //     name: 'UA Local Discovery Server on STERFIVEPC2',
        //     fqdn: 'UA Local Discovery Server on STERFIVEPC2._opcua-tcp._tcp.local',
        //     host: 'STERFIVEPC2.local',
        //     referer:
        //     {
        //        address: '172.18.207.145',
        //        family: 'IPv4',
        //        port: 5353,
        //        size: 363
        //     },
        //     port: 4840,
        //     type: 'opcua-tcp',
        //     protocol: 'tcp',
        //  subtypes: []
        // },
        debugLog("a new OPCUA server has been registered");

        const recordId = ++self.recordId;
        const serverName = service.name;

        service.txt.caps = service.txt.caps || "";
        let serverCapabilities = service.txt.caps.split(",").map(x => x.toUpperCase()).sort();

        assert(serverCapabilities instanceof Array);

        const path = service.txt.path || "";
        const discoveryUrl = "opc.tcp://" + service.host + ":" + service.port + path;

        self.registeredServers.push(
            new discovery_service.ServerOnNetwork({
                recordId: recordId,
                serverName: serverName,
                discoveryUrl: discoveryUrl,
                serverCapabilities: serverCapabilities
            }));
        self.lastUpdateDate = new Date(Date.now());
    }

    function removeService(service) {
        const serverName = service.name;
        debugLog("a OPCUA server has been unregistered ", serverName);
        const index = self.registeredServers.findIndex(server => server.serverName = serverName);
        if (index === -1) {
            debugLog("Cannot find server with name ", serverName, " in registeredServers");
            return;
        }
        self.registeredServers.splice(index, 1); // reove element at index
        self.lastUpdateDate = new Date(Date.now());
    }

    self.responser.on("up", function (service) {
        // xx console.log("xxx responder up ",service);
        addService(service);
    });

    self.responser.on("down", function (service) {
        removeService(service);
    });

}

MDNSResponser.prototype.dispose = function () {
    const self = this;
    self.bonjour = null;
    discovery_service.releaseBonjour();
};

OPCUADiscoveryServer.prototype._on_RegisterServer2Request = function (message, channel) {

    const self = this;
    const request = message.request;

    assert(request._schema.name === "RegisterServer2Request");
    assert(request instanceof RegisterServer2Request);
    const response = __internalRegisterServer(RegisterServer2Response, self, request.server, request.discoveryConfiguration);
    assert(response instanceof RegisterServer2Response);
    channel.send_response("MSG", response, message);
};

OPCUADiscoveryServer.prototype._on_RegisterServerRequest = function (message, channel) {
    const self = this;
    const request = message.request;
    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);
    const response = __internalRegisterServer(RegisterServerResponse, self, request.server, null);
    assert(response instanceof RegisterServerResponse);
    channel.send_response("MSG", response, message);
};

OPCUADiscoveryServer.prototype.__defineGetter__("registeredServerCount", function () {
    return Object.keys(this.registered_servers).length;
});


OPCUADiscoveryServer.prototype.getServers = function (channel) {
    const self = this;
    self.serverInfo.discoveryUrls = self.getDiscoveryUrls(channel);
    const servers = [self.serverInfo];
    _.forEach(self.registered_servers, function (registered_server) {
        servers.push(registered_server.serverInfo);
    });

    return servers;
};

OPCUADiscoveryServer.prototype._on_FindServersOnNetworkRequest = function (message, channel) {

    // from OPCUA 1.04 part 4
    // This Service returns the Servers known to a Discovery Server. Unlike FindServer, this Service is
    // only implemented by Discovery Servers.
    // The Client may reduce the number of results returned by specifying filter criteria. An empty list is
    // returned if no Server matches the criteria specified by the Client.
    // This Service shall not require message security but it may require transport layer security.
    // Each time the Discovery Server creates or updates a record in its cache it shall assign a
    // monotonically increasing identifier to the record. This allows Clients to request records in batches
    // by specifying the identifier for the last record received in the last call to FindServersOnNetwork.
    // To support this the Discovery Server shall return records in numerical order starting from the
    // lowest record identifier. The Discovery Server shall also return the last time the counter was reset
    // for example due to a restart of the Discovery Server. If a Client detects that this time is more
    // recent than the last time the Client called the Service it shall call the Service again with a
    // startingRecordId of 0.
    // This Service can be used without security and it is therefore vulnerable to Denial Of Service
    // (DOS) attacks. A Server should minimize the amount of processing required to send the response
    // for this Service. This can be achieved by preparing the result in advance

    const self = this;
    const request = message.request;

    assert(request._schema.name === "FindServersOnNetworkRequest");
    assert(request instanceof FindServersOnNetworkRequest);

    function sendError(statusCode) {
        const response = new FindServersOnNetworkResponse({responseHeader: {serviceResult: statusCode}});
        return channel.send_response("MSG", response, message);
    }

    //     startingRecordId         Counter Only records with an identifier greater than this number will be
    //                              returned.
    //                              Specify 0 to start with the first record in the cache.
    //     maxRecordsToReturn       UInt32 The maximum number of records to return in the response.
    //                              0 indicates that there is no limit.
    //     serverCapabilityFilter[] String List of Server capability filters. The set of allowed server capabilities
    //                              are defined in Part 12.
    //                              Only records with all of the specified server capabilities are
    //                              returned.
    //                              The comparison is case insensitive.
    //                              If this list is empty then no filtering is performed

    // ------------------------

    //The last time the counters were reset.
    const lastCounterResetTime = new Date();

    //  servers[] ServerOnNetwork List of DNS service records that meet criteria specified in the
    // request. This list is empty if no Servers meet the criteria
    const servers = [];

    function hasCapabilities(serverCapabilities, serverCapabilityFilter) {
        if (serverCapabilityFilter.length === 0 ) {
            return true; // filter is empty => no filtering should take place
        }
        return serverCapabilities.join(" ").match(serverCapabilityFilter);
    }

    const serverCapabilityFilter = request.serverCapabilityFilter.map(x => x.toUpperCase()).sort().join(" ");

    for (let server of self.mDnsResponder.registeredServers) {
        if (server.recordId <= request.startingRecordId) {
            continue;
        }
        if (!hasCapabilities(server.serverCapabilities, serverCapabilityFilter)) {
            continue;
        }
        servers.push(server);
        if (servers.length === request.maxRecordsToReturn) {
            return;
        }
    }

    const response = new FindServersOnNetworkResponse({
        lastCounterResetTime: lastCounterResetTime,//  UtcTime The last time the counters were reset
        servers: servers,
    });
    channel.send_response("MSG", response, message);

};

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
