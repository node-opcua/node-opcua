/**
 * @module node-opcua-server-discovery
 */

import os from "os";
import path from "path";
import { URL } from "url";
import { callbackify } from "util";

import chalk from "chalk";
import envPaths from "env-paths";

import { assert } from "node-opcua-assert";
import { UAString } from "node-opcua-basic-types";
import { makeApplicationUrn } from "node-opcua-common";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import {
    Message,
    MessageSecurityMode,
    Response,
    SecurityPolicy,
    ServerSecureChannelLayer,
    ServiceFault
} from "node-opcua-secure-channel";
import {
    AddStandardEndpointDescriptionsParam,
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
    isSameService,
    serviceToString,
    announcementToServiceConfig,
    ServerOnNetwork
} from "node-opcua-service-discovery";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { ApplicationDescriptionOptions, ApplicationType } from "node-opcua-service-endpoints";
import { ErrorCallback, StatusCode, StatusCodes } from "node-opcua-status-code";

import { MDNSResponder } from "./mdns_responder";

const debugLog = make_debugLog("LDSSERVER");
const doDebug = checkDebugFlag("LDSSERVER");
const errorLog = make_errorLog("LDSSERVER");

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
    alternateHostname?: string[];
    securityPolicies?: SecurityPolicy[];
    securityModes?: MessageSecurityMode[];
    hostname?: string;
}

interface RegisteredServerExtended extends RegisteredServer {
    bonjourHolder: BonjourHolder;
    serverInfo: ApplicationDescriptionOptions;
    discoveryConfiguration?: MdnsDiscoveryConfiguration[];
}

type RegisterServerMap = Map<string, RegisteredServerExtended>;


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

export interface OPCUADiscoveryServer {
    on(eventName: "onUnregisterServer", eventHandler: (server: RegisteredServer, forced: boolean) => void): this;
    on(eventName: "onRegisterServer", eventHandler: (server: RegisteredServer, firstTime: boolean) => void): this;
    once(eventName: "onUnregisterServer", eventHandler: (server: RegisteredServer, forced: boolean) => void): this;
    once(eventName: "onRegisterServer", eventHandler: (server: RegisteredServer, firstTime: boolean) => void): this;

}

// const weakMap = new WeakMap<MdnsDiscoveryConfiguration, BonjourHolder>;

export class OPCUADiscoveryServer extends OPCUABaseServer {
    private mDnsLDSAnnouncer?: BonjourHolder;
    public mDnsResponder?: MDNSResponder;
    public readonly registeredServers: RegisterServerMap;

    private _delayInit?: () => Promise<void>;

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


        // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
        // opc.tcp://localhost:4840/UADiscovery
        const port = options.port || 4840;

        this.capabilitiesForMDNS = ["LDS"];
        this.registeredServers = new Map();

        this.mDnsResponder = undefined;

        this._delayInit = async (): Promise<void> => {
            const endPoint = new OPCUAServerEndPoint({
                port,

                certificateChain: this.getCertificateChain(),

                certificateManager: this.serverCertificateManager,

                privateKey: this.getPrivateKey(),
                serverInfo: this.serverInfo
            });

            const options1: AddStandardEndpointDescriptionsParam = {
                allowAnonymous: true,
                securityModes: options.securityModes,
                securityPolicies: options.securityPolicies,
                userTokenTypes: [], // << intentionally empty (discovery server without session)
                hostname: options.hostname,
                alternateHostname: options.alternateHostname,
                disableDiscovery: true
            };

            endPoint.addStandardEndpointDescriptions(options1);

            this.endpoints.push(endPoint);

            endPoint.on("message", (message: Message, channel: ServerSecureChannelLayer) => {
                this.on_request(message, channel);
            });
        };
    }

    public async start(): Promise<void> {
        assert(!this.mDnsResponder);
        assert(Array.isArray(this.capabilitiesForMDNS));

        this._preInitTask.push(async () => {
            await this._delayInit!();
        });

        await new Promise<void>((resolve, reject) =>
            super.start((err?: Error | null) =>
                err ? reject(err) : resolve()));

        const endpointUri = this.getEndpointUrl();
        const { hostname } = new URL(endpointUri);

        this.mDnsResponder = new MDNSResponder();

        this.mDnsLDSAnnouncer = new BonjourHolder();

        // declare the discovery server itself in bonjour
        await this.mDnsLDSAnnouncer.announcedOnMulticastSubnet(
            {
                capabilities: this.capabilitiesForMDNS,
                name: this.serverInfo.applicationUri!,
                path: "/DiscoveryServer",
                host: hostname || "",
                port: this.endpoints[0].port
            });
    }


    #shutting_down = false;
    public async shutdown(): Promise<void> {
        if (this.#shutting_down) return;
        this.#shutting_down = true;




        debugLog("stopping announcement of LDS on mDNS");
        // 
        for (const registeredServer of this.registeredServers.values()) {
            debugLog("LDS is shutting down and is forcefuly unregistering server", registeredServer.serverUri);
            await this.#internalRegisterServerOffline(registeredServer, true);
        }   
        
        if (this.mDnsResponder) {
            debugLog("disposing mDnsResponder");
            await this.mDnsResponder.dispose();
            this.mDnsResponder = undefined;
            debugLog(" mDnsResponder disposed");
        }

        if (this.mDnsLDSAnnouncer) {
            debugLog("disposing mDnsLDSAnnouncer of this LDS to the mDNS");
            await this.mDnsLDSAnnouncer.stopAnnouncedOnMulticastSubnet();
            this.mDnsLDSAnnouncer = undefined;
        }

        debugLog("Shutting down Discovery Server");
        await new Promise<void>((resolve, reject) =>
            super.shutdown((err) => err ? reject(err) : resolve())
        );
        debugLog("stopping announcement of LDS on mDNS - DONE");
        // add a extra delay to ensure that the port is really closed
        // and registered server propagated the fact that LDS is not here anymore
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }

    /**
     * returns the number of registered servers
     */
    public get registeredServerCount(): number {
        return this.registeredServers.size;
    }

    public getServers(channel: ServerSecureChannelLayer): ApplicationDescription[] {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();

        const servers: ApplicationDescription[] = [this.serverInfo];

        for (const registered_server of this.registeredServers.values()) {
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
        this.#internalRegisterServer(
            RegisterServer2Response,
            request.server,
            request.discoveryConfiguration as MdnsDiscoveryConfiguration[],
        ).then((response?: Response) => {
            channel.send_response("MSG", response!, message);
        }).catch((err: Error) => {
            errorLog("What shall I do ?", err.message);
            errorLog(err);
            let additional_messages = [];
            additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request.schema.name);
            additional_messages.push(err.message);
            if (err.stack) {
                additional_messages = additional_messages.concat(err.stack.split("\n"));
            }

            const response = OPCUADiscoveryServer.makeServiceFault(
                StatusCodes.BadInternalError,
                additional_messages
            );
            channel.send_response("MSG", response, message);
        });
        // istanbul ignore next
    }

    protected _on_RegisterServerRequest(message: Message, channel: ServerSecureChannelLayer) {
        assert(message.request instanceof RegisterServerRequest);
        const request = message.request as RegisterServerRequest;
        assert(request.schema.name === "RegisterServerRequest");
        this.#internalRegisterServer(
            RegisterServerResponse,
            request.server,
            undefined).then((response) => {

                channel.send_response("MSG", response!, message);

            }).catch((err: Error) => {
                let additional_messages = [];
                additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request.schema.name);
                additional_messages.push(err.message);
                if (err.stack) {
                    additional_messages = additional_messages.concat(err.stack.split("\n"));
                }
                const response = OPCUADiscoveryServer.makeServiceFault(
                    StatusCodes.BadInternalError,
                    additional_messages
                );
                channel.send_response("MSG", response, message);
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
            const response1 = new FindServersOnNetworkResponse({ responseHeader: { serviceResult: statusCode } });
            return channel.send_response("MSG", response1, message);
        } sendError;

        if(this.#shutting_down) {
            return sendError(StatusCodes.BadShutdown);
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
            for (const serverOnNetwork of this.mDnsResponder.registeredServers) {
                debugLog("Exploring server ", serverOnNetwork.serverName);

                if (serverOnNetwork.recordId <= request.startingRecordId) {
                    continue;
                }
                if (!hasCapabilities(serverOnNetwork.serverCapabilities, serverCapabilityFilter)) {
                    // istanbul ignore next
                    if (doDebug) {
                        debugLog(
                            "   server ",
                            serverOnNetwork.serverName,
                            serverOnNetwork.serverCapabilities ? serverOnNetwork.serverCapabilities.join(",") : [],
                            " does not match serverCapabilities ",
                            serverCapabilityFilter
                        );
                    }
                    continue;
                }
                debugLog("   server ", serverOnNetwork.serverName, " found");
                servers.push(serverOnNetwork);
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


    async #stopAnnouncedOnMulticastSubnet(conf: MdnsDiscoveryConfiguration): Promise<void> {
        const b = (conf as any).bonjourHolder as BonjourHolder;
        await b.stopAnnouncedOnMulticastSubnet();
        (conf as any).bonjourHolder = undefined;
    }

    async #announcedOnMulticastSubnet(conf: MdnsDiscoveryConfiguration, announcement: Announcement): Promise<void> {
        const serviceConfig = announcementToServiceConfig(announcement);

        let b = (conf as any).bonjourHolder as BonjourHolder;
        if (b && b.serviceConfig) {
            if (isSameService(b.serviceConfig, serviceConfig)) {
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
            await this.#stopAnnouncedOnMulticastSubnet(conf);
        }
        b = new BonjourHolder();
        (conf as any).bonjourHolder = b;
        await b.announcedOnMulticastSubnet(announcement);
    }
    async #dealWithDiscoveryConfiguration(
        previousConfMap: Map<string, MdnsDiscoveryConfiguration>,
        server1: RegisteredServer,
        serverInfo: ApplicationDescriptionOptions,
        discoveryConfiguration: MdnsDiscoveryConfiguration
    ): Promise<StatusCode> {
        // mdnsServerName     String     The name of the Server when it is announced via mDNS.
        //                               See Part 12 for the details about mDNS. This string shall be 
        //                               less than 64 bytes.
        //                               If not specified the first element of the serverNames array 
        //                               is used (truncated to 63 bytes if necessary).
        // serverCapabilities [] String  The set of Server capabilities supported by the Server.
        //                               A Server capability is a short identifier for a feature
        //                               The set of allowed Server capabilities are defined in Part 12.
        discoveryConfiguration.mdnsServerName ??= server1.serverNames![0].text;

        serverInfo.discoveryUrls ??= [];

        const endpointUrl = serverInfo.discoveryUrls[0]!;
        const parsedUrl = new URL(endpointUrl);

        discoveryConfiguration.serverCapabilities = discoveryConfiguration.serverCapabilities || [];
        const announcement = {
            capabilities: discoveryConfiguration.serverCapabilities.map((x: UAString) => x!) || ["DA"],
            name: discoveryConfiguration.mdnsServerName!,
            host: parsedUrl.hostname || "",
            path: parsedUrl.pathname || "/",
            port: parseInt(parsedUrl.port!, 10)
        };

        if (previousConfMap.has(discoveryConfiguration.mdnsServerName!)) {
            // configuration already exists
            debugLog("Configuration ", discoveryConfiguration.mdnsServerName, " already exists !");
            const prevConf = previousConfMap.get(discoveryConfiguration.mdnsServerName!)!;
            previousConfMap.delete(discoveryConfiguration.mdnsServerName!);
            (discoveryConfiguration as any).bonjourHolder = (prevConf as any).bonjourHolder;
        }

        // let's announce the server on the  multicast DNS
        await this.#announcedOnMulticastSubnet(discoveryConfiguration, announcement);
        return StatusCodes.Good;
    }


    /**
     * 
     * @param server 
     * @param forced  true :indicated if the LDS is forcing the Server to be seen as unregistered, false
     * when the offline comes from the server it self.
     * @returns 
     */
    async #internalRegisterServerOffline(server: RegisteredServerExtended,  forced: boolean) {

        const key = server.serverUri!;

        let configurationResults: StatusCode[] | null = null;
        // server is announced offline
        if (this.registeredServers.has(key)) {
            const serverToUnregister = this.registeredServers.get(key)!;
            debugLog(chalk.cyan("unregistering server : "), chalk.yellow(serverToUnregister.serverUri!));
            configurationResults = [];

            const discoveryConfigurations = serverToUnregister.discoveryConfiguration || [];

            for (const conf of discoveryConfigurations) {
                await this.#stopAnnouncedOnMulticastSubnet(conf);
                configurationResults.push(StatusCodes.Good);
            }
            this.registeredServers.delete(key);
            serverToUnregister.isOnline= false;
            this.emit("onUnregisterServer", serverToUnregister, forced);
        }
        return configurationResults;

    }
    async #internalRegisterServerOnline(
        server: RegisteredServerExtended,
        discoveryConfigurations: MdnsDiscoveryConfiguration[]
    ) {
        assert(discoveryConfigurations);

        const key = server.serverUri!;

        let configurationResults: StatusCode[] | null = null;

        debugLog(chalk.cyan(" registering server : "), chalk.yellow(server.serverUri));

        // prepare serverInfo which will be used by FindServers
        const serverInfo: ApplicationDescriptionOptions = {
            applicationName: server.serverNames![0], // which one shall we use ?
            applicationType: server.serverType,
            applicationUri: server.serverUri,
            discoveryUrls: server.discoveryUrls,
            gatewayServerUri: server.gatewayServerUri,
            productUri: server.productUri
            // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
        };

        const previousConfMap: Map<string, MdnsDiscoveryConfiguration> = new Map();

        // let check in the server has already been registed on this LDS 
        let firstTimeRegistration = true;
        if (this.registeredServers.has(key)) {
            // server already exists and must only be updated
            const previousServer = this.registeredServers.get(key)!;
            for (const conf of previousServer.discoveryConfiguration!) {
                previousConfMap.set(conf.mdnsServerName!, conf);
            }
            firstTimeRegistration = false;
        }

        this.registeredServers.set(key, server);

        this.emit("onRegisterServer", server, firstTimeRegistration);

        // xx server.semaphoreFilePath = server.semaphoreFilePath;
        // xx server.serverNames = server.serverNames;
        server.serverInfo = serverInfo;
        server.discoveryConfiguration = discoveryConfigurations;


        configurationResults = [];
        for (const conf of discoveryConfigurations) {
            const statusCode = await this.#dealWithDiscoveryConfiguration(
                previousConfMap, 
                server, 
                serverInfo, 
                conf
            );
            configurationResults.push(statusCode);
        }
        // now also unregister unprocessed
        if (previousConfMap.size !== 0) {
            debugLog(" Warning some conf need to be removed !");
        }
        return configurationResults;

    }
    // eslint-disable-next-line max-statements
    async #internalRegisterServer(
        RegisterServerXResponse:  typeof RegisterServer2Response | typeof RegisterServerResponse,
        rawServer: RegisteredServer,
        discoveryConfigurations?: MdnsDiscoveryConfiguration[]
    ): Promise<Response> {


        // #region check parameter validity
        function sendError(statusCode: StatusCode): Response {
            debugLog(chalk.red("_on_RegisterServer(2)Request error"), statusCode.toString());
            const response1 = new ServiceFault({
                responseHeader: { serviceResult: statusCode }
            });
            return response1;
        }

        if (this.#shutting_down) {
            return sendError(StatusCodes.BadShutdown);
        }

        const server = rawServer as any as RegisteredServerExtended;

        // check serverType is valid
        if (!_isValidServerType(server.serverType)) {
            debugLog("Invalid server Type", ApplicationType[server.serverType]);
            return sendError(StatusCodes.BadInvalidArgument);
        }
        if (!server.serverUri) {
            debugLog("Missing serverURI");
            return sendError(StatusCodes.BadInvalidArgument);
        }
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


        // BadServerUriInvalid
        // TODO
        // #endregion

        if (!discoveryConfigurations) {
            discoveryConfigurations = [
                new MdnsDiscoveryConfiguration({
                    mdnsServerName: undefined,
                    serverCapabilities: ["NA"]
                })
            ];
        }

        const configurationResults = server?.isOnline ?

            await this.#internalRegisterServerOnline(server, discoveryConfigurations) :
            await this.#internalRegisterServerOffline(server, false);


        const response = new RegisterServerXResponse({
        });
        if (response instanceof RegisterServer2Response) {
            response.configurationResults = configurationResults;
        }
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

