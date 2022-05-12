/**
 * @module node-opcua-server-discovery
 */

import * as os from "os";
import * as path from "path";
import * as url from "url";
import { callbackify } from "util";

import * as chalk from "chalk";
import envPaths = require("env-paths");

import { assert } from "node-opcua-assert";
import { UAString } from "node-opcua-basic-types";
import { makeApplicationUrn } from "node-opcua-common";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { extractFullyQualifiedDomainName, resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import { Message, Response, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { OPCUABaseServer, OPCUABaseServerOptions, OPCUAServerEndPoint } from "node-opcua-server";

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
    sameService,
    serviceToString,
    announcementToServiceConfig,
    ServerOnNetwork
} from "node-opcua-service-discovery";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { ApplicationDescriptionOptions, ApplicationType } from "node-opcua-service-endpoints";
import { ErrorCallback, StatusCode, StatusCodes } from "node-opcua-status-code";

import { MDNSResponder } from "./mdns_responder";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function hasCapabilities(serverCapabilities: UAString[] | null, serverCapabilityFilter: string): boolean {
    if (serverCapabilities == null) {
        return true; // filter is empty => no filtering should take place
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

const defaultProductUri = "NodeOPCUA-LocalDiscoveryServer";
const defaultApplicationUri = makeApplicationUrn(os.hostname(), defaultProductUri);

function getDefaultCertificateManager(): OPCUACertificateManager {
    const config = envPaths(defaultProductUri).config;
    return new OPCUACertificateManager({
        name: "PKI",
        rootFolder: path.join(config, "PKI"),

        automaticallyAcceptUnknownCertificate: true
    });
}

export class OPCUADiscoveryServer extends OPCUABaseServer {
    private mDnsResponder?: MDNSResponder;
    private readonly registeredServers: RegisterServerMap;
    private bonjourHolder: BonjourHolder;
    private _delayInit?: () => void;

    constructor(options: OPCUADiscoveryServerOptions) {
        options.serverInfo = options.serverInfo || {};
        const serverInfo = options.serverInfo;

        serverInfo.applicationType = ApplicationType.DiscoveryServer;

        serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;

        serverInfo.productUri = serverInfo.productUri || defaultProductUri;

        serverInfo.applicationName = serverInfo.applicationName || {
            text: defaultProductUri,

            locale: null
        };

        serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
        serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
        serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

        options.serverCertificateManager = options.serverCertificateManager || getDefaultCertificateManager();

        super(options);

        this.bonjourHolder = new BonjourHolder();

        // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
        // opc.tcp://localhost:4840/UADiscovery
        const port = options.port || 4840;

        this.capabilitiesForMDNS = ["LDS"];
        this.registeredServers = {};

        this.mDnsResponder = undefined;

        this._delayInit = async (): Promise<void> => {
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
        };
    }

    public async start(): Promise<void>;
    public start(callback: ErrorCallback): void;
    public start(callback?: ErrorCallback): any {
        assert(!this.mDnsResponder);
        assert(Array.isArray(this.capabilitiesForMDNS));

        this._preInitTask.push(async () => {
            await this._delayInit!();
        });

        super.start((err?: Error | null) => {
            if (err) {
                return callback!(err);
            }
            this.mDnsResponder = new MDNSResponder();
            // declare discovery server in bonjour
            this.bonjourHolder.announcedOnMulticastSubnetWithCallback(
                {
                    capabilities: this.capabilitiesForMDNS,
                    name: this.serverInfo.applicationUri!,
                    path: "/DiscoveryServer",
                    port: this.endpoints[0].port
                },
                (err2: Error | null) => {
                    callback!(err2!);
                }
            );
        });
    }

    public async shutdown(): Promise<void>;
    public shutdown(callback: ErrorCallback): void;
    public shutdown(callback?: ErrorCallback): any {
        debugLog("stopping announcement of LDS on mDNS");

        if (this.mDnsResponder) {
            this.mDnsResponder.dispose();
            this.mDnsResponder = undefined;
        }

        this.bonjourHolder.stopAnnouncedOnMulticastSubnetWithCallback((err?: Error | null) => {
            if (err) {
                console.log("Error ", err.message);
            }

            debugLog("stopping announcement of LDS on mDNS - DONE");
            debugLog("Shutting down Discovery Server");

            super.shutdown(() => {
                setTimeout(()=>{
                    callback!();
                },100);
            });
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
            const serverInfo: ApplicationDescription = new ApplicationDescription(registered_server.serverInfo);
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
                // istanbul ignore next
                if (err) {
                    // tslint:disable-next-line: no-console
                    console.log("What shall I do ?", err.message);
                    // tslint:disable-next-line: no-console
                    console.log(err);
                    let additional_messages = [];
                    additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request.schema.name);
                    additional_messages.push(err.message);
                    if (err.stack) {
                        additional_messages = additional_messages.concat(err.stack.split("\n"));
                    }

                    response = OPCUADiscoveryServer.makeServiceFault(StatusCodes.BadInternalError, additional_messages);
                    channel.send_response("MSG", response, message);
                } else {
                    channel.send_response("MSG", response!, message);
                }
            }
        );
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
                channel.send_response("MSG", response!, message);
            }
        );
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

        request.serverCapabilityFilter = request.serverCapabilityFilter || [];
        const serverCapabilityFilter: string = request.serverCapabilityFilter
            .map((x: UAString) => x!.toUpperCase())
            .sort()
            .join(" ");

        debugLog(" startingRecordId = ", request.startingRecordId);

        if (this.mDnsResponder) {
            for (const server of this.mDnsResponder.registeredServers) {
                debugLog("Exploring server ", server.serverName);

                if (server.recordId <= request.startingRecordId) {
                    continue;
                }
                if (!hasCapabilities(server.serverCapabilities, serverCapabilityFilter)) {
                    // istanbul ignore next
                    if (doDebug) {
                        debugLog(
                            "   server ",
                            server.serverName,
                            server.serverCapabilities ? server.serverCapabilities.join(",") : [],
                            " does not match serverCapabilities ",
                            serverCapabilityFilter
                        );
                    }
                    continue;
                }
                debugLog("   server ", server.serverName, " found");
                servers.push(server);
                if (servers.length === request.maxRecordsToReturn) {
                    debugLog("max records to return reached", request.maxRecordsToReturn);
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

    protected async __internalRegisterServerWithCallback(
        RegisterServerXResponse: any /* RegisterServer2Response | RegisterServerResponse */,
        rawServer: RegisteredServer,
        discoveryConfigurations: MdnsDiscoveryConfiguration[] | undefined,
        callback: (err: Error | null, response?: Response) => void
    ) {
        // istanbul ignore next
        callback(new Error("internal Error"));
    }

    // eslint-disable-next-line max-statements
    protected async __internalRegisterServer(
        RegisterServerXResponse: any /* RegisterServer2Response | RegisterServerResponse */,
        rawServer: RegisteredServer,
        discoveryConfigurations?: MdnsDiscoveryConfiguration[]
    ): Promise<Response> {
        const server = rawServer as any as RegisteredServerExtended;

        if (!discoveryConfigurations) {
            discoveryConfigurations = [
                new MdnsDiscoveryConfiguration({
                    mdnsServerName: undefined,
                    serverCapabilities: ["NA"]
                })
            ];
        }

        function sendError(statusCode: StatusCode): Response {
            debugLog(chalk.red("_on_RegisterServer(2)Request error"), statusCode.toString());
            const response1 = new RegisterServerXResponse({
                responseHeader: { serviceResult: statusCode }
            });
            return response1;
        }

        async function _stop_announcedOnMulticastSubnet(conf: MdnsDiscoveryConfiguration): Promise<void> {
            const b = (conf as any).bonjourHolder as BonjourHolder;
            await b.stopAnnnouncedOnMulticastSubnet();
            (conf as any).bonjourHolder = undefined;
        }

        async function _announcedOnMulticastSubnet(conf: MdnsDiscoveryConfiguration, announcement: Announcement): Promise<void> {
            const serviceConfig = announcementToServiceConfig(announcement);

            let b = (conf as any).bonjourHolder as BonjourHolder;
            if (b && b.serviceConfig) {
                if (sameService(b.serviceConfig, serviceConfig)) {
                    debugLog("Configuration ", conf.mdnsServerName, " has not changed !");
                    // nothing to do
                    return;
                } else {
                    // istanbul ignore next
                    if (doDebug) {
                        debugLog("Configuration ", conf.mdnsServerName, " HAS changed !");
                        debugLog(" Was ", serviceToString(b.serviceConfig));
                        debugLog(" is  ", announcement);
                    }
                }
                await _stop_announcedOnMulticastSubnet(conf);
            }
            b = new BonjourHolder();
            (conf as any).bonjourHolder = b;
            await b.announcedOnMulticastSubnet(announcement);
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
            debugLog("Invalid server Type", ApplicationType[server.serverType]);
            return sendError(StatusCodes.BadInvalidArgument);
        }

        if (!server.serverUri) {
            debugLog("Missing serverURI");
            return sendError(StatusCodes.BadInvalidArgument);
        }

        // BadServerUriInvalid
        // TODO
        server.serverNames = server.serverNames || [];
        // BadServerNameMissing
        if (server.serverNames.length === 0 || !server.serverNames[0].text) {
            return sendError(StatusCodes.BadServerNameMissing);
        }

        // BadDiscoveryUrlMissing
        server.discoveryUrls = server.discoveryUrls || [];
        if (server.discoveryUrls.length === 0 || !server.discoveryUrls[0]) {
            return sendError(StatusCodes.BadDiscoveryUrlMissing);
        }

        const key = server.serverUri;
        let configurationResults: StatusCode[] | null = null;

        if (server.isOnline) {
            debugLog(chalk.cyan(" registering server : "), chalk.yellow(server.serverUri));

            // prepare serverInfo which will be used by FindServers
            const serverInfo: ApplicationDescriptionOptions = {
                applicationName: server.serverNames[0], // which one shall we use ?
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

(OPCUADiscoveryServer as any).prototype.__internalRegisterServerWithCallback = callbackify(
    (OPCUADiscoveryServer as any).prototype.__internalRegisterServer
);

// tslint:disable-next-line: no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
OPCUADiscoveryServer.prototype.start = thenify.withCallback(OPCUADiscoveryServer.prototype.start, opts);
OPCUADiscoveryServer.prototype.shutdown = thenify.withCallback(OPCUADiscoveryServer.prototype.shutdown, opts);
