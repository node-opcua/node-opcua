import chalk from "chalk";
import * as fs from "fs";
import { assert } from "node-opcua-assert";
import * as path from "path";
import * as _ from "underscore";
import * as url from "url";

import { UAString } from "node-opcua-basic-types";
import { CertificateManager } from "node-opcua-certificate-manager";
import { makeApplicationUrn } from "node-opcua-common";
import { make_debugLog } from "node-opcua-debug";
import { get_fully_qualified_domain_name } from "node-opcua-hostname";
import { Message, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import {
    OPCUABaseServer,
    OPCUABaseServerOptions,
    OPCUAServerEndPoint
} from "node-opcua-server";
import {
    _announcedOnMulticastSubnet,
    _announceServerOnMulticastSubnet,
    _stop_announcedOnMulticastSubnet,
    FindServersOnNetworkRequest,
    FindServersOnNetworkResponse,
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse
} from "node-opcua-service-discovery";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import {
    ApplicationType
} from "node-opcua-service-endpoints";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { MDNSResponser } from "./mdns_responder";

const debugLog = make_debugLog(__filename);
const doDebug = false;

function constructFilename(p: string): string {
    const filename = path.join(__dirname, "..", p);
    // xx console.log("fi = ",filename);
    return filename;
}

function hasCapabilities(
  serverCapabilities: string[],
  serverCapabilityFilter: string
): boolean {
    if (serverCapabilityFilter.length === 0) {
        return true; // filter is empty => no filtering should take place
    }
    return !!serverCapabilities.join(" ").match(serverCapabilityFilter);
}

export interface OPCUADiscoveryServerOptions extends OPCUABaseServerOptions {

    certificateFile?: string;
    port?: number;

}

export class OPCUADiscoveryServer extends OPCUABaseServer {

    public serverInfo: ApplicationDescription;
    public capabilitiesForMDNS: string[];

    private mDnsResponder: any;
    private registered_servers: any;

    constructor(options: OPCUADiscoveryServerOptions) {

        const default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
        options.certificateFile = options.certificateFile || default_certificate_file;
        assert(fs.existsSync(options.certificateFile));

        const default_private_key_file = constructFilename("certificates/PKI/own/private/private_key.pem");
        options.privateKeyFile = options.privateKeyFile || default_private_key_file;
        assert(fs.existsSync(options.certificateFile));

        const defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");

        super(options);

        const serverInfo = new ApplicationDescription(options.serverInfo);

        serverInfo.applicationType = ApplicationType.DiscoveryServer;
        serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;
        serverInfo.productUri = serverInfo.productUri || "SampleDiscoveryServer";
        serverInfo.applicationName = serverInfo.applicationName || { text: "SampleDiscoveryServer", locale: null };
        serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
        serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
        serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

        this.serverInfo = serverInfo;

        const port = options.port || 4840;

        this.capabilitiesForMDNS = ["LDS"];
        this.registered_servers = {} as any;
        // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
        // opc.tcp://localhost:4840/UADiscovery

        const endPoint = new OPCUAServerEndPoint({
            port,

            certificateChain: this.getCertificateChain(),

            certificateManager: this.serverCertificateManager,

            privateKey: this.getPrivateKey(),
            serverInfo: this.serverInfo
        });
        endPoint.addStandardEndpointDescriptions();

        this.endpoints.push(endPoint);

        endPoint.on("message", (message: Message, channel: ServerSecureChannelLayer) => {
            this.on_request(message, channel);
        });
        this.mDnsResponder = null;
    }

    public start(done: (err?: Error) => void): void {
        assert(this.mDnsResponder === null);
        assert(_.isArray(this.capabilitiesForMDNS));

        super.start((err?: Error | null) => {
            if (!err) {
                // declare server in bonjour
                _announcedOnMulticastSubnet(this, {
                    applicationUri: this.serverInfo.applicationUri!,
                    capabilities: this.capabilitiesForMDNS,
                    path: "/DiscoveryServer",
                    port: this.endpoints[0].port
                });
                //
                this.mDnsResponder = new MDNSResponser();

            }
            done(err!);
        });
    }

    public shutdown(done: (err?: Error) => void) {
        _stop_announcedOnMulticastSubnet(this);
        if (this.mDnsResponder) {
            this.mDnsResponder.dispose();
            this.mDnsResponder = null;
        }
        super.shutdown(done);
    }

    public get registeredServerCount(): number {
        return Object.keys(this.registered_servers).length;
    }

    public getServers(channel: ServerSecureChannelLayer): ApplicationDescription[] {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();

        const servers: ApplicationDescription[] = [this.serverInfo];

        for (const registered_server of Object.values(this.registered_servers)) {
            servers.push((registered_server as any).serverInfo);
        }

        return servers;
    }

    public _announcedServerOnTheMulticastSubnet() {

    }

    protected _on_RegisterServer2Request(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as RegisterServer2Request;

        assert(request.schema.name === "RegisterServer2Request");
        assert(request instanceof RegisterServer2Request);
        const response = __internalRegisterServer(RegisterServer2Response, this, request.server, request.discoveryConfiguration);
        assert(response instanceof RegisterServer2Response);
        channel.send_response("MSG", response, message);
    }

    protected _on_RegisterServerRequest(message: Message, channel: ServerSecureChannelLayer) {

        const request = message.request as RegisterServerRequest;
        assert(request.schema.name === "RegisterServerRequest");
        assert(request instanceof RegisterServerRequest);
        const response = __internalRegisterServer(RegisterServerResponse, this, request.server, null);
        assert(response instanceof RegisterServerResponse);
        channel.send_response("MSG", response, message);
    }

    protected _on_FindServersOnNetworkRequest(message: Message, channel: ServerSecureChannelLayer) {

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

        const request = message.request as FindServersOnNetworkRequest;

        assert(request.schema.name === "FindServersOnNetworkRequest");
        assert(request instanceof FindServersOnNetworkRequest);

        function sendError(statusCode: StatusCode) {
            const response1 = new FindServersOnNetworkResponse({ responseHeader: { serviceResult: statusCode } });
            return channel.send_response("MSG", response1, message);
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

        // The last time the counters were reset.
        const lastCounterResetTime = new Date();

        //  servers[] ServerOnNetwork List of DNS service records that meet criteria specified in the
        // request. This list is empty if no Servers meet the criteria
        const servers = [];

        const serverCapabilityFilter = request.serverCapabilityFilter!.map(
          (x: UAString) => x!.toUpperCase()).sort().join(" ");

        for (const server of this.mDnsResponder.registeredServers) {
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
            lastCounterResetTime, //  UtcTime The last time the counters were reset
            servers
        });
        channel.send_response("MSG", response, message);

    }

}

/*== private
 * returns true if the serverType can be added to a discovery server.
 * @param serverType
 * @return {boolean}
 * @private
 */
function _isValidServerType(serverType: ApplicationType): boolean {

    switch (serverType) {
        case ApplicationType.Client:
            return false;
        case ApplicationType.Server:
        case ApplicationType.ClientAndServer:
        case ApplicationType.DiscoveryServer:
            return true;
    }
    return false;
}

function __internalRegisterServer(
  RegisterServerXResponse: any,
  discoveryServer: any,
  server: any,
  discoveryConfiguration: any
) {

    function sendError(statusCode: StatusCode) {
        /// Xx console.log(chalk.red("_on_RegisterServerRequest error"), statusCode.toString());
        const response1 = new RegisterServerXResponse({
            responseHeader: { serviceResult: statusCode }
        });
        return response1;
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
            discoveryUrls: server.discoveryUrls

        };
        // xx server.semaphoreFilePath = server.semaphoreFilePath;
        // xx server.serverNames = server.serverNames;
        server.serverInfo = serverInfo;
        server.discoveryConfiguration = discoveryConfiguration;

        if (discoveryConfiguration) {

            const endpointUrl = serverInfo.discoveryUrls[0];
            const parsedUrl = url.parse(endpointUrl);

            const options = {
                applicationUri: serverInfo.applicationUri,

                port: parseInt(parsedUrl.port!, 10),

                path: parsedUrl.pathname || "/",

                capabilities: server.discoveryConfiguration.serverCapabilities || ["DA"]
            };
            // let's announce the server on the  mutlicast DNS
            server.bonjourEntry = _announceServerOnMulticastSubnet(discoveryServer.bonjour, options);
        }
        discoveryServer.registered_servers[key].serverInfo = serverInfo;

    } else {
        if (key in discoveryServer.registered_servers) {
            const server1 = discoveryServer.registered_servers[key];
            debugLog(chalk.cyan("unregistering server : "), server1.serverUri.yellow);
            if (server1.bonjourEntry) {
                server1.bonjourEntry.stop();
                server1.bonjourEntry = null;
            }
            delete discoveryServer.registered_servers[key];
        }

    }

    const response = new RegisterServerXResponse({});
    response.configurationResults = null;

    return response;
}

exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
