"use strict";
const chalk = require("chalk");
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

class OPCUADiscoveryServer extends OPCUABaseServer {

    constructor(options) {

        const default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
        options.certificateFile = options.certificateFile || default_certificate_file;
        assert(fs.existsSync(options.certificateFile));

        const default_private_key_file = constructFilename("certificates/PKI/own/private/private_key.pem");
        options.privateKeyFile = options.privateKeyFile || default_private_key_file;
        assert(fs.existsSync(options.certificateFile));

        const defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");

        super(options);

        const serverInfo = options.serverInfo || {};

        serverInfo.applicationType = ApplicationType.DiscoveryServer;
        serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;
        serverInfo.productUri = serverInfo.productUri || "SampleDiscoveryServer";
        serverInfo.applicationName = serverInfo.applicationName || {text: "SampleDiscoveryServer", locale: null};
        serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
        serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
        serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

        this.serverInfo = serverInfo;

        const port = options.port || 4840;

        this.capabilitiesForMDNS = ["LDS"];
        this.registered_servers = {};
        // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
        // opc.tcp://localhost:4840/UADiscovery

        const endPoint = new OPCUAServerEndPoint({
            port: port,
            certificateChain: this.getCertificateChain(),
            privateKey: this.getPrivateKey(),
            serverInfo: this.serverInfo
        });
        endPoint.addStandardEndpointDescriptions();

        this.endpoints.push(endPoint);

        endPoint.on("message", (message, channel) => {
            this.on_request(message, channel);
        });
        this.mDnsResponder = null;
    }


    start(done) {
        assert(this.mDnsResponder === null);
        assert(_.isArray(this.capabilitiesForMDNS));

        super.start((err) => {
            if (!err) {
                // declare server in bonjour
                _announcedOnMulticastSubnet(this, {
                    applicationUri: this.serverInfo.applicationUri,
                    port: this.endpoints[0].port,
                    path: "/DiscoveryServer",
                    capabilities: this.capabilitiesForMDNS
                });
                //
                this.mDnsResponder = new MDNSResponser();

            }
            done(err);
        });
    }

    shutdown(done) {
        _stop_announcedOnMulticastSubnet(this);
        if (this.mDnsResponder) {
            this.mDnsResponder.dispose();
            this.mDnsResponder = null;
        }
        super.shutdown(done);
    }


    _announcedServerOnTheMulticastSubnet() {

    }

    _on_RegisterServer2Request(message, channel) {

        const request = message.request;

        assert(request.schema.name === "RegisterServer2Request");
        assert(request instanceof RegisterServer2Request);
        const response = __internalRegisterServer(RegisterServer2Response, this, request.server, request.discoveryConfiguration);
        assert(response instanceof RegisterServer2Response);
        channel.send_response("MSG", response, message);
    }

    _on_RegisterServerRequest(message, channel) {

        const request = message.request;
        assert(request.schema.name === "RegisterServerRequest");
        assert(request instanceof RegisterServerRequest);
        const response = __internalRegisterServer(RegisterServerResponse, this, request.server, null);
        assert(response instanceof RegisterServerResponse);
        channel.send_response("MSG", response, message);
    }

    get registeredServerCount() {
        return Object.keys(this.registered_servers).length;
    }

    getServers(channel) {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls(channel);
        const servers = [this.serverInfo];
        _.forEach(this.registered_servers, (registered_server) => {
            servers.push(registered_server.serverInfo);
        });

        return servers;
    };

    _on_FindServersOnNetworkRequest(message, channel) {

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

        const request = message.request;

        assert(request.schema.name === "FindServersOnNetworkRequest");
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

        for (let server of this.mDnsResponder.registeredServers) {
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

}

/*== private
 * returns true if the serverType can be added to a discovery server.
 * @param serverType
 * @return {boolean}
 * @private
 */
function  _isValidServerType(serverType) {

    switch (serverType) {
        case ApplicationType.Client:
            return false;
        case ApplicationType.Server:
        case ApplicationType.ClientAndServer:
        case UserTokenType.DiscoveryServer:
            return true;
    }
    return false;
}


function __internalRegisterServer(RegisterServerXResponse, discoveryServer, server, discoveryConfiguration) {

    function sendError(statusCode) {
        ///Xx xconsole.log(chalk.red("_on_RegisterServerRequest error"), statusCode.toString());
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
        debugLog(chalk.cyan(" registering server : "), server.serverUri.yellow);
        discoveryServer.registered_servers[key] = server;

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
            server.bonjourEntry = _announceServerOnMulticastSubnet(discoveryServer.bonjour, options);
        }
        discoveryServer.registered_servers[key].serverInfo = serverInfo;

    } else {
        if (key in  discoveryServer.registered_servers) {
            const server  = discoveryServer.registered_servers[key];
            debugLog(chalk.cyan("unregistering server : "), server.serverUri.yellow);
            if (server.bonjourEntry) {
                server.bonjourEntry.stop();
                server.bonjourEntry = null;
            }
            delete  discoveryServer.registered_servers[key];
        }

    }

    const response = new RegisterServerXResponse({});
    response.configurationResults = null;

    return response;
}


class MDNSResponser {


    constructor() {

        this.registeredServers = [];

        this.bonjour = discovery_service.acquireBonjour();
        this.recordId = 0;

        this.responser = this.bonjour.find({
            type: "opcua-tcp",
            protocol: "tcp"
        });

        const addService = (service) => {
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

            const recordId = ++this.recordId;
            const serverName = service.name;

            service.txt.caps = service.txt.caps || "";
            let serverCapabilities = service.txt.caps.split(",").map(x => x.toUpperCase()).sort();

            assert(serverCapabilities instanceof Array);

            const path = service.txt.path || "";
            const discoveryUrl = "opc.tcp://" + service.host + ":" + service.port + path;

            this.registeredServers.push(
                new discovery_service.ServerOnNetwork({
                    recordId: recordId,
                    serverName: serverName,
                    discoveryUrl: discoveryUrl,
                    serverCapabilities: serverCapabilities
                }));
            this.lastUpdateDate = new Date(Date.now());
        };

        const removeService = (service) => {
            const serverName = service.name;
            debugLog("a OPCUA server has been unregistered ", serverName);
            const index = this.registeredServers.findIndex(server => server.serverName = serverName);
            if (index === -1) {
                debugLog("Cannot find server with name ", serverName, " in registeredServers");
                return;
            }
            this.registeredServers.splice(index, 1); // reove element at index
            this.lastUpdateDate = new Date(Date.now());
        };

        this.responser.on("up", (service) => {
            // xx console.log("xxx responder up ",service);addService(service);
            addService(service);
        });

        this.responser.on("down", (service) => {
            removeService(service);
        });
    }
    dispose() {
        this.bonjour = null;
        discovery_service.releaseBonjour();
    }
}


exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
