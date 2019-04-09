/**
 * @module node-opcua-server-discovery
 */
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as _ from "underscore";
import * as url from "url";
import {callbackify} from "util";

import {assert} from "node-opcua-assert";
import {UAString} from "node-opcua-basic-types";
import {makeApplicationUrn} from "node-opcua-common";
import {checkDebugFlag, make_debugLog} from "node-opcua-debug";
import {get_fully_qualified_domain_name} from "node-opcua-hostname";
import {Message, Response, ServerSecureChannelLayer} from "node-opcua-secure-channel";
import {
    OPCUABaseServer,
    OPCUABaseServerOptions,
    OPCUAServerEndPoint
} from "node-opcua-server";
import {
    Announcement,
    BonjourHolder,
    FindServersOnNetworkRequest,
    FindServersOnNetworkResponse,
    MdnsDiscoveryConfiguration,
    RegisteredServer,
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse,
    sameAnnouncement,
    ServerOnNetwork,
} from "node-opcua-service-discovery";
import {ApplicationDescription} from "node-opcua-service-endpoints";
import {
    ApplicationDescriptionOptions,
    ApplicationType
} from "node-opcua-service-endpoints";
import {StatusCode, StatusCodes} from "node-opcua-status-code";

import {MDNSResponder} from "./mdns_responder";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function constructFilename(p: string): string {
    const filename = path.join(__dirname, "..", p);
    return filename;
}

function hasCapabilities(
    serverCapabilities: UAString[] | null,
    serverCapabilityFilter: string
): boolean {
    if (serverCapabilities == null) {
        return true;  // filter is empty => no filtering should take place
    }
    if (serverCapabilityFilter.length === 0) {
        return true; // filter is empty => no filtering should take place
    }
    return !!serverCapabilities.join(" ").match(serverCapabilityFilter);
}

export interface OPCUADiscoveryServerOptions extends OPCUABaseServerOptions {

    certificateFile?: string;
    port?: number;

}

interface RegisteredServerExtended extends RegisteredServer {
    bonjourHolder: BonjourHolder;
    serverInfo: ApplicationDescriptionOptions;
    discoveryConfiguration?: MdnsDiscoveryConfiguration[];
}

interface RegisterServerMap {
    [key: string]: RegisteredServerExtended;
}

export class OPCUADiscoveryServer extends OPCUABaseServer {

    private mDnsResponder?: MDNSResponder;
    private readonly registeredServers: RegisterServerMap;
    private bonjourHolder: BonjourHolder;

    constructor(options: OPCUADiscoveryServerOptions) {

        const default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
        options.certificateFile = options.certificateFile || default_certificate_file;
        assert(fs.existsSync(options.certificateFile));

        const default_private_key_file = constructFilename("certificates/PKI/own/private/private_key.pem");
        options.privateKeyFile = options.privateKeyFile || default_private_key_file;
        assert(fs.existsSync(options.certificateFile));

        const defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");

        super(options);

        this.bonjourHolder = new BonjourHolder();

        const serverInfo = new ApplicationDescription(options.serverInfo);

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
        this.registeredServers = {};

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
            if (doDebug) {
                debugLog(" RECEIVE MESSAGE", message.request.constructor.name);
            }
            this.on_request(message, channel);
        });
        this.mDnsResponder = undefined;
    }

    public start(done: (err?: Error) => void): void {

        assert(!this.mDnsResponder);
        assert(_.isArray(this.capabilitiesForMDNS));

        super.start((err?: Error | null) => {
            if (err) {
                return done(err);
            }
            this.mDnsResponder = new MDNSResponder();
            // declare discovery server in bonjour
            this.bonjourHolder._announcedOnMulticastSubnetWithCallback({
                capabilities: this.capabilitiesForMDNS,
                name: this.serverInfo.applicationUri!,
                path: "/DiscoveryServer",
                port: this.endpoints[0].port
            }, (err: Error | null) => {
                done(err!);
            });
        });
    }

    public shutdown(done: (err?: Error) => void) {

        if (this.mDnsResponder) {
            this.mDnsResponder.dispose();
            this.mDnsResponder = undefined;
        }
        debugLog("stopping announcement of LDS on mDNS");
        this.bonjourHolder._stop_announcedOnMulticastSubnetWithCallback(
            () => {
                debugLog("stopping announcement of LDS on mDNS - DONE");
                debugLog("Shutting down Discovery Server");
                super.shutdown(done);
            });

    }

    /**
     * returns the number of registered servers
     */
    public get registeredServerCount(): number {
        return Object.keys(this.registeredServers).length;
    }

    public getServers(channel: ServerSecureChannelLayer): ApplicationDescription[] {

        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();

        const servers: ApplicationDescription[] = [this.serverInfo];

        for (const registered_server of Object.values(this.registeredServers)) {
            const serverInfo: ApplicationDescription = (registered_server as any).serverInfo;
            servers.push(serverInfo);
        }

        return servers;
    }

    protected _on_RegisterServer2Request(message: Message, channel: ServerSecureChannelLayer) {

        assert(message.request instanceof RegisterServer2Request);
        const request = message.request as RegisterServer2Request;

        assert(request.schema.name === "RegisterServer2Request");

        request.discoveryConfiguration = request.discoveryConfiguration || [];
        this.__internalRegisterServerWithCallback(
            RegisterServer2Response,
            request.server,
            request.discoveryConfiguration as MdnsDiscoveryConfiguration[],
            (err: Error | null, response?: Response) => {
                assert(response instanceof RegisterServer2Response);
                channel.send_response("MSG", response!, message);
            });
    }

    protected _on_RegisterServerRequest(message: Message, channel: ServerSecureChannelLayer) {

        assert(message.request instanceof RegisterServerRequest);
        const request = message.request as RegisterServerRequest;
        assert(request.schema.name === "RegisterServerRequest");
        this.__internalRegisterServerWithCallback(
            RegisterServerResponse,
            request.server,
            undefined,
            (err: Error | null, response?: Response) => {
                assert(response instanceof RegisterServerResponse);
                channel.send_response("MSG", response!, message);
            });
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

        assert(message.request instanceof FindServersOnNetworkRequest);
        const request = message.request as FindServersOnNetworkRequest;

        assert(request.schema.name === "FindServersOnNetworkRequest");

        function sendError(statusCode: StatusCode) {
            const response1 = new FindServersOnNetworkResponse({responseHeader: {serviceResult: statusCode}});
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

        request.serverCapabilityFilter = request.serverCapabilityFilter || [];
        const serverCapabilityFilter: string = request.serverCapabilityFilter.map(
            (x: UAString) => x!.toUpperCase()).sort().join(" ");

        debugLog(" startingRecordId = ", request.startingRecordId);

        if (this.mDnsResponder) {
            for (const server of this.mDnsResponder.registeredServers) {
                if (server.recordId <= request.startingRecordId) {
                    continue;
                }
                if (!hasCapabilities(server.serverCapabilities, serverCapabilityFilter)) {
                    continue;
                }
                servers.push(server);
                if (servers.length === request.maxRecordsToReturn) {
                    break;
                }
            }
        }
        const response = new FindServersOnNetworkResponse({
            lastCounterResetTime, //  UtcTime The last time the counters were reset
            servers
        });
        channel.send_response("MSG", response, message);

    }

    private async __internalRegisterServerWithCallback(
        RegisterServerXResponse: any /* RegisterServer2Response | RegisterServerResponse */,
        rawServer: RegisteredServer,
        discoveryConfigurations: MdnsDiscoveryConfiguration[] | undefined,
        callback: (err: Error | null, response?: Response) => void
    ) {
        callback(new Error("internal Error"));
    }

    private async __internalRegisterServer(
        RegisterServerXResponse: any /* RegisterServer2Response | RegisterServerResponse */,
        rawServer: RegisteredServer,
        discoveryConfigurations?: MdnsDiscoveryConfiguration[]
    ): Promise<Response> {

        const server = rawServer as any as RegisteredServerExtended;

        if (!discoveryConfigurations) {
            discoveryConfigurations = [new MdnsDiscoveryConfiguration({
                mdnsServerName: undefined,
                serverCapabilities: ["NA"]
            })];
        }

        function sendError(statusCode: StatusCode): Response {
            debugLog(chalk.red("_on_RegisterServer(2)Request error"), statusCode.toString());
            const response1 = new RegisterServerXResponse({
                responseHeader: {serviceResult: statusCode}
            });
            return response1;
        }

        async function _stop_announcedOnMulticastSubnet(conf: MdnsDiscoveryConfiguration): Promise<void> {
            const b = ((conf as any).bonjourHolder) as BonjourHolder;
            await b._stop_announcedOnMulticastSubnet();
            (conf as any).bonjourHolder = undefined;
        }

        async function _announcedOnMulticastSubnet(
            conf: MdnsDiscoveryConfiguration,
            announcement: Announcement
        ): Promise<void> {

            let b = ((conf as any).bonjourHolder) as BonjourHolder;
            if (b) {
                if (sameAnnouncement(b.announcement!, announcement)) {
                    debugLog("Configuration ", conf.mdnsServerName, " has not changed !");
                    // nothing to do
                    return;
                } else {
                    debugLog("Configuration ", conf.mdnsServerName, " HAS changed !");
                    debugLog(" Was ", b.announcement!);
                    debugLog(" is  ", announcement);
                }
                await _stop_announcedOnMulticastSubnet(conf);
            }
            b = new BonjourHolder();
            ((conf as any).bonjourHolder) = b;
            await b._announcedOnMulticastSubnet(announcement);
        }

        async function dealWithDiscoveryConfiguration(
            previousConfMap: any,
            server1: RegisteredServer,
            serverInfo: ApplicationDescriptionOptions,
            discoveryConfiguration: MdnsDiscoveryConfiguration
        ): Promise<StatusCode> {
            // mdnsServerName     String     The name of the Server when it is announced via mDNS.
            //                               See Part 12 for the details about mDNS. This string shall be less than 64 bytes.
            //                               If not specified the first element of the serverNames array is used
            //                               (truncated to 63 bytes if necessary).
            // serverCapabilities [] String  The set of Server capabilities supported by the Server.
            //                               A Server capability is a short identifier for a feature
            //                               The set of allowed Server capabilities are defined in Part 12.
            discoveryConfiguration.mdnsServerName = discoveryConfiguration.mdnsServerName || server1.serverNames![0].text;

            serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

            const endpointUrl = serverInfo.discoveryUrls[0]!;
            const parsedUrl = url.parse(endpointUrl);

            discoveryConfiguration.serverCapabilities = discoveryConfiguration.serverCapabilities || [];
            const announcement = {
                capabilities: discoveryConfiguration.serverCapabilities.map((x: UAString) => x!) || ["DA"],
                name: discoveryConfiguration.mdnsServerName!,
                path: parsedUrl.pathname || "/",
                port: parseInt(parsedUrl.port!, 10)
            };

            if (previousConfMap[discoveryConfiguration.mdnsServerName!]) {
                // configuration already exists
                debugLog("Configuration ", discoveryConfiguration.mdnsServerName, " already exists !");
                const prevConf = previousConfMap[discoveryConfiguration.mdnsServerName!];
                delete previousConfMap[discoveryConfiguration.mdnsServerName!];
                (discoveryConfiguration as any).bonjourHolder = prevConf.bonjourHolder;
            }

            // let's announce the server on the  multicast DNS
            await _announcedOnMulticastSubnet(discoveryConfiguration, announcement);
            return StatusCodes.Good;
        }

        // check serverType is valid
        if (!_isValidServerType(server.serverType)) {
            return sendError(StatusCodes.BadInvalidArgument);
        }

        if (!server.serverUri) {
            return sendError(StatusCodes.BadInvalidArgument);
        }

        // BadServerUriInvalid
        // TODO
        server.serverNames = server.serverNames || [];
        // BadServerNameMissing
        if (server.serverNames.length === 0) {
            return sendError(StatusCodes.BadServerNameMissing);
        }

        // BadDiscoveryUrlMissing
        server.discoveryUrls = server.discoveryUrls || [];
        if (server.discoveryUrls.length === 0) {
            return sendError(StatusCodes.BadDiscoveryUrlMissing);
        }

        const key = server.serverUri;
        let configurationResults: StatusCode[] | null = null;

        if (server.isOnline) {

            debugLog(chalk.cyan(" registering server : "), chalk.yellow(server.serverUri));

            // prepare serverInfo which will be used by FindServers
            const serverInfo: ApplicationDescriptionOptions = {
                applicationName: server.serverNames[0],  // which one shall we use ?
                applicationType: server.serverType,
                applicationUri: server.serverUri,
                discoveryUrls: server.discoveryUrls,
                gatewayServerUri: server.gatewayServerUri,
                productUri: server.productUri
                // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
            };

            const previousConfMap: any = [];
            if (this.registeredServers[key]) {
                // server already exists and must only be updated
                const previousServer = this.registeredServers[key];

                for (const conf of previousServer.discoveryConfiguration!) {
                    previousConfMap[conf.mdnsServerName!] = conf;
                }

            }
            this.registeredServers[key] = server;

            // xx server.semaphoreFilePath = server.semaphoreFilePath;
            // xx server.serverNames = server.serverNames;
            server.serverInfo = serverInfo;
            server.discoveryConfiguration = discoveryConfigurations;

            assert(discoveryConfigurations);

            configurationResults = [];
            for (const conf of discoveryConfigurations) {
                const statusCode = await dealWithDiscoveryConfiguration(previousConfMap, server, serverInfo, conf);
                configurationResults.push(statusCode);
            }
            // now also unregister unprocessed
            if (Object.keys(previousConfMap).length !== 0) {
                debugLog(" Warning some conf need to be removed !");
            }

        } else {
            // server is announced offline
            if (key in this.registeredServers) {
                const server1 = this.registeredServers[key];
                debugLog(chalk.cyan("unregistering server : "), chalk.yellow(server1.serverUri!));
                configurationResults = [];

                discoveryConfigurations = server1.discoveryConfiguration || [];

                for (const conf of discoveryConfigurations) {
                    await _stop_announcedOnMulticastSubnet(conf);
                    configurationResults.push(StatusCodes.Good);
                }
                delete this.registeredServers[key];
            }
        }

        const response = new RegisterServerXResponse({
            configurationResults
        });
        return response;
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

(OPCUADiscoveryServer as any).prototype.__internalRegisterServerWithCallback =
    callbackify((OPCUADiscoveryServer as any).prototype.__internalRegisterServer);
exports.OPCUADiscoveryServer = OPCUADiscoveryServer;
