/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as async from "async";
import * as chalk from "chalk";
import { withLock } from "@ster5/global-mutex";
import { assert } from "node-opcua-assert";
import {
    getDefaultCertificateManager,
    ICertificateManager,
    makeSubject,
    OPCUACertificateManager
} from "node-opcua-certificate-manager";
import { IOPCUASecureObjectOptions, makeApplicationUrn, OPCUASecureObject } from "node-opcua-common";
import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { installPeriodicClockAdjustment, uninstallPeriodicClockAdjustment } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { displayTraceFromThisProjectOnly } from "node-opcua-debug";
import { extractFullyQualifiedDomainName, getHostname, resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import { Message, Response, ServerSecureChannelLayer, ServerSecureChannelParent } from "node-opcua-secure-channel";
import { FindServersRequest, FindServersResponse } from "node-opcua-service-discovery";
import { ApplicationType, GetEndpointsResponse } from "node-opcua-service-endpoints";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { ServiceFault } from "node-opcua-service-secure-channel";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ApplicationDescriptionOptions } from "node-opcua-types";
import { EndpointDescription, GetEndpointsRequest } from "node-opcua-types";
import { matchUri } from "node-opcua-utils";

import { performCertificateSanityCheck } from "node-opcua-client";
import { OPCUAServerEndPoint } from "./server_end_point";
import { IChannelData } from "./i_channel_data";
import { ISocketData } from "./i_socket_data";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = errorLog;

function constructFilename(p: string): string {
    let filename = path.join(__dirname, "..", p);
    if (!fs.existsSync(filename)) {
        // try one level up
        filename = path.join(__dirname, p);
        if (!fs.existsSync(filename)) {
            throw new Error("Cannot find filename " + filename + " ( __dirname = " + __dirname);
        }
    }
    return filename;
}

const default_server_info = {
    // The globally unique identifier for the application instance. This URI is used as
    // ServerUri in Services if the application is a Server.
    applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server"),

    // The globally unique identifier for the product.
    productUri: "NodeOPCUA-Server",

    // A localized descriptive name for the application.
    applicationName: { text: "NodeOPCUA", locale: "en" },
    applicationType: ApplicationType.Server,
    gatewayServerUri: "",

    discoveryProfileUri: "",

    discoveryUrls: []
};

function cleanupEndpoint(endpoint: OPCUAServerEndPoint) {
    if (endpoint._on_new_channel) {
        assert(typeof endpoint._on_new_channel === "function");
        endpoint.removeListener("newChannel", endpoint._on_new_channel);
        endpoint._on_new_channel = undefined;
    }

    if (endpoint._on_close_channel) {
        assert(typeof endpoint._on_close_channel === "function");
        endpoint.removeListener("closeChannel", endpoint._on_close_channel);
        endpoint._on_close_channel = undefined;
    }
    if (endpoint._on_connectionRefused) {
        assert(typeof endpoint._on_connectionRefused === "function");
        endpoint.removeListener("connectionRefused", endpoint._on_connectionRefused);
        endpoint._on_connectionRefused = undefined;
    }
    if (endpoint._on_openSecureChannelFailure) {
        assert(typeof endpoint._on_openSecureChannelFailure === "function");
        endpoint.removeListener("openSecureChannelFailure", endpoint._on_openSecureChannelFailure);
        endpoint._on_openSecureChannelFailure = undefined;
    }
}

/**
 *
 */
export interface OPCUABaseServerOptions extends IOPCUASecureObjectOptions {
    /**
     * the information used in the end point description
     */
    serverInfo?: ApplicationDescriptionOptions;
    /**
     * the server Certificate Manager
     */
    serverCertificateManager?: OPCUACertificateManager;
}

const emptyCallback = () => {
    /* empty */
};

/**
 * @class OPCUABaseServer
 * @constructor
 */
export class OPCUABaseServer extends OPCUASecureObject {
    public static makeServiceFault = makeServiceFault;

    /**
     * The type of server
     */
    get serverType(): ApplicationType {
        return this.serverInfo.applicationType;
    }

    public serverInfo: ApplicationDescription;
    public endpoints: OPCUAServerEndPoint[];
    public readonly serverCertificateManager: OPCUACertificateManager;
    public capabilitiesForMDNS: string[];
    protected _preInitTask: any[];

    protected options: OPCUABaseServerOptions;

    constructor(options?: OPCUABaseServerOptions) {
        options = options || ({} as OPCUABaseServerOptions);

        if (!options.serverCertificateManager) {
            options.serverCertificateManager = getDefaultCertificateManager("PKI");
        }
        options.privateKeyFile = options.privateKeyFile || options.serverCertificateManager.privateKey;
        options.certificateFile =
            options.certificateFile || path.join(options.serverCertificateManager.rootDir, "own/certs/certificate.pem");

        super(options);

        this.serverCertificateManager = options.serverCertificateManager;
        this.capabilitiesForMDNS = [];
        this.endpoints = [];
        this.options = options;
        this._preInitTask = [];

        const serverInfo: ApplicationDescriptionOptions = {
            ...default_server_info,
            ...options.serverInfo
        };
        serverInfo.applicationName = coerceLocalizedText(serverInfo.applicationName);
        this.serverInfo = new ApplicationDescription(serverInfo);

        if (this.serverInfo.applicationName.toString().match(/urn:/)) {
            errorLog("[NODE-OPCUA-E06] application name cannot be a urn", this.serverInfo.applicationName.toString());
        }

        this.serverInfo.applicationName!.locale = this.serverInfo.applicationName?.locale || "en";

        if (!this.serverInfo.applicationName?.locale) {
            warningLog(
                "[NODE-OPCUA-W24] the server applicationName must have a valid locale : ",
                this.serverInfo.applicationName.toString()
            );
        }

        const __applicationUri = serverInfo.applicationUri || "";

        (this.serverInfo as any).__defineGetter__("applicationUri", () => resolveFullyQualifiedDomainName(__applicationUri));

        this._preInitTask.push(async () => {
            const fqdn = await extractFullyQualifiedDomainName();
        });

        this._preInitTask.push(async () => {
            await this.initializeCM();
        });
    }

    protected async createDefaultCertificate(): Promise<void> {
        if (fs.existsSync(this.certificateFile)) {
            return;
        }
        const lockfile = path.join(this.certificateFile + ".lock");
        await withLock({ lockfile }, async () => {
            if (!fs.existsSync(this.certificateFile)) {
                const applicationUri = this.serverInfo.applicationUri!;
                const hostname = getHostname();
                await this.serverCertificateManager.createSelfSignedCertificate({
                    applicationUri,
                    dns: [hostname],
                    // ip: await getIpAddresses(),
                    outputFile: this.certificateFile,

                    subject: makeSubject(this.serverInfo.applicationName.text!, hostname),

                    startDate: new Date(),
                    validity: 365 * 10 // 10 years
                });
            }
        });
    }
    
    public async initializeCM(): Promise<void> {
        await this.serverCertificateManager.initialize();
        await this.createDefaultCertificate();
        debugLog("privateKey      = ", this.privateKeyFile, this.serverCertificateManager.privateKey);
        debugLog("certificateFile = ", this.certificateFile);
        await performCertificateSanityCheck.call(this, "server", this.serverCertificateManager, this.serverInfo.applicationUri!);
    }

    /**
     * start all registered endPoint, in parallel, and call done when all endPoints are listening.
     * @method start
     * @async
     * @param {callback} done
     */
    public start(done: (err?: Error | null) => void): void {
        assert(typeof done === "function");
        this.startAsync()
            .then(() => done(null))
            .catch((err) => done(err));
    }

    protected async performPreInitialization(): Promise<void> {
        const tasks = this._preInitTask;
        this._preInitTask = [];
        for (const task of tasks) {
            await task();
        }
    }

    protected async startAsync(): Promise<void> {
        await this.performPreInitialization();

        assert(Array.isArray(this.endpoints));
        assert(this.endpoints.length > 0, "We need at least one end point");

        installPeriodicClockAdjustment();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const server = this;
        const _on_new_channel = function (this: OPCUAServerEndPoint, channel: ServerSecureChannelLayer) {
            server.emit("newChannel", channel, this);
        };

        const _on_close_channel = function (this: OPCUAServerEndPoint, channel: ServerSecureChannelLayer) {
            server.emit("closeChannel", channel, this);
        };

        const _on_connectionRefused = function (this: OPCUAServerEndPoint, socketData: ISocketData) {
            server.emit("connectionRefused", socketData, this);
        };

        const _on_openSecureChannelFailure = function (
            this: OPCUAServerEndPoint,
            socketData: ISocketData,
            channelData: IChannelData
        ) {
            server.emit("openSecureChannelFailure", socketData, channelData, this);
        };

        const promises: Promise<void>[] = [];

        for (const endpoint of this.endpoints) {
            assert(!endpoint._on_close_channel);

            endpoint._on_new_channel = _on_new_channel;
            endpoint.on("newChannel", endpoint._on_new_channel);

            endpoint._on_close_channel = _on_close_channel;
            endpoint.on("closeChannel", endpoint._on_close_channel);

            endpoint._on_connectionRefused = _on_connectionRefused;
            endpoint.on("connectionRefused", endpoint._on_connectionRefused);

            endpoint._on_openSecureChannelFailure = _on_openSecureChannelFailure;
            endpoint.on("openSecureChannelFailure", endpoint._on_openSecureChannelFailure);

            promises.push(new Promise<void>((resolve, reject) => endpoint.start((err) => (err ? reject(err) : resolve()))));
        }
        await Promise.all(promises);
    }

    /**
     * shutdown all server endPoints
     * @async
     */
    public shutdown(done: (err?: Error) => void): void {
        assert(typeof done === "function");
        uninstallPeriodicClockAdjustment();
        this.serverCertificateManager.dispose().then(() => {
            debugLog("OPCUABaseServer#shutdown starting");
            async.forEach(
                this.endpoints,
                (endpoint: OPCUAServerEndPoint, callback: (err?: Error) => void) => {
                    cleanupEndpoint(endpoint);
                    endpoint.shutdown(callback);
                },
                (err?: Error | null) => {
                    debugLog("shutdown completed");
                    done(err!);
                }
            );
        });
    }

    public async shutdownChannels(): Promise<void>;
    public shutdownChannels(callback: (err?: Error | null) => void): void;
    public shutdownChannels(callback?: (err?: Error | null) => void): Promise<void> | void {
        assert(typeof callback === "function");
        debugLog("OPCUABaseServer#shutdownChannels");
        async.forEach(
            this.endpoints,
            (endpoint: OPCUAServerEndPoint, inner_callback: (err?: Error | null) => void) => {
                debugLog(" shutting down endpoint ", endpoint.endpointDescriptions()[0].endpointUrl);
                async.series(
                    [
                        // xx                  (callback2: (err?: Error| null) => void) => {
                        // xx                      endpoint.suspendConnection(callback2);
                        // xx                  },
                        (callback2: (err?: Error | null) => void) => {
                            endpoint.abruptlyInterruptChannels();
                            endpoint.shutdown(callback2);
                        }
                        // xx              (callback2: (err?: Error| null) => void) => {
                        // xx                 endpoint.restoreConnection(callback2);
                        // xx              }
                    ],
                    inner_callback
                );
            },
            callback!
        );
    }

    /**
     * @private
     */
    public on_request(message: Message, channel: ServerSecureChannelLayer): void {
        assert(message.request);
        assert(message.requestId !== 0);
        const request = message.request;

        // install channel._on_response so we can intercept its call and  emit the "response" event.
        if (!channel._on_response) {
            channel._on_response = (msg: string, response1: Response /*, inner_message: Message*/) => {
                this.emit("response", response1, channel);
            };
        }

        // prepare request
        this.prepare(message, channel);

        if (doDebug) {
            debugLog(
                chalk.green.bold("--------------------------------------------------------"),
                channel.channelId,
                request.schema.name
            );
        }

        let errMessage: string;
        let response: Response;

        this.emit("request", request, channel);

        try {
            // handler must be named _on_ActionRequest()
            const handler = (this as any)["_on_" + request.schema.name];
            if (typeof handler === "function") {
                // eslint-disable-next-line prefer-rest-params
                handler.apply(this, arguments);
            } else {
                errMessage = "[NODE-OPCUA-W07] Unsupported Service : " + request.schema.name;
                warningLog(errMessage);
                debugLog(chalk.red.bold(errMessage));
                response = makeServiceFault(StatusCodes.BadServiceUnsupported, [errMessage]);
                channel.send_response("MSG", response, message, emptyCallback);
            }
        } catch (err) {
            /* istanbul ignore if */
            const errMessage1 = "[NODE-OPCUA-W08] EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request.schema.name;
            warningLog(chalk.red.bold(errMessage1));
            warningLog(request.toString());
            displayTraceFromThisProjectOnly(err as Error);

            let additional_messages = [];
            additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request.schema.name);
            if (err instanceof Error) {
                additional_messages.push(err.message);
                if (err.stack) {
                    additional_messages = additional_messages.concat(err.stack.split("\n"));
                }
            }
            response = makeServiceFault(StatusCodes.BadInternalError, additional_messages);

            channel.send_response("MSG", response, message, emptyCallback);
        }
    }

    /**
     * @private
     */
    public _get_endpoints(endpointUrl?: string | null): EndpointDescription[] {
        let endpoints: EndpointDescription[] = [];
        for (const endPoint of this.endpoints) {
            const ep = endPoint.endpointDescriptions();
            const epFiltered = endpointUrl ? ep.filter((e) => matchUri(e.endpointUrl, endpointUrl)) : ep;
            endpoints = endpoints.concat(epFiltered);
        }
        return endpoints;
    }
    /**
     * get one of the possible endpointUrl
     */
    public getEndpointUrl(): string {
        return this._get_endpoints()[0].endpointUrl!;
    }

    public getDiscoveryUrls(): string[] {
        const discoveryUrls = this.endpoints.map((e: OPCUAServerEndPoint) => {
            return e.endpointDescriptions()[0].endpointUrl!;
        });
        return discoveryUrls;
    }

    public getServers(channel: ServerSecureChannelLayer): ApplicationDescription[] {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();
        const servers = [this.serverInfo];
        return servers;
    }

    /**
     * set all the end point into a state where they do not accept further connections
     *
     * note:
     *     this method is useful for testing purpose
     *
     */
    public async suspendEndPoints(): Promise<void>;
    public suspendEndPoints(callback: (err?: Error) => void): void;
    public suspendEndPoints(callback?: (err?: Error) => void): void | Promise<void> {
        /* istanbul ignore next */
        if (!callback) {
            throw new Error("Internal Error");
        }
        async.forEach(
            this.endpoints,
            (ep: OPCUAServerEndPoint, _inner_callback) => {
                /* istanbul ignore next */
                if (doDebug) {
                    debugLog("Suspending ", ep.endpointDescriptions()[0].endpointUrl);
                }

                ep.suspendConnection((err?: Error | null) => {
                    /* istanbul ignore next */
                    if (doDebug) {
                        debugLog("Suspended ", ep.endpointDescriptions()[0].endpointUrl);
                    }
                    _inner_callback(err);
                });
            },
            (err?: Error | null) => callback(err!)
        );
    }

    /**
     * set all the end point into a state where they do accept connections
     * note:
     *    this method is useful for testing purpose
     */
    public async resumeEndPoints(): Promise<void>;
    public resumeEndPoints(callback: (err?: Error) => void): void;
    public resumeEndPoints(callback?: (err?: Error) => void): void | Promise<void> {
        async.forEach(
            this.endpoints,
            (ep: OPCUAServerEndPoint, _inner_callback) => {
                ep.restoreConnection(_inner_callback);
            },
            (err?: Error | null) => callback!(err!)
        );
    }

    protected prepare(message: Message, channel: ServerSecureChannelLayer): void {
        /* empty */
    }

    /**
     * @private
     */
    protected _on_GetEndpointsRequest(message: Message, channel: ServerSecureChannelLayer): void {
        const request = message.request as GetEndpointsRequest;

        assert(request.schema.name === "GetEndpointsRequest");

        const response = new GetEndpointsResponse({});

        response.endpoints = this._get_endpoints(null);

        response.endpoints = response.endpoints.filter((endpoint: EndpointDescription) => !(endpoint as any).restricted);

        // apply filters
        if (request.profileUris && request.profileUris.length > 0) {
            response.endpoints = response.endpoints.filter((endpoint: any) => {
                return request.profileUris!.indexOf(endpoint.transportProfileUri) >= 0;
            });
        }

        // adjust locale on ApplicationName to match requested local or provide
        // a string with neutral locale (locale === null)
        // TODO: find a better way to handle this
        response.endpoints.forEach((endpoint: EndpointDescription) => {
            endpoint.server.applicationName.locale = "en-US";
        });

        channel.send_response("MSG", response, message, emptyCallback);
    }

    /**
     * @private
     */
    protected _on_FindServersRequest(message: Message, channel: ServerSecureChannelLayer): void {
        // Release 1.02  13  OPC Unified Architecture, Part 4 :
        //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
        //   attacks. A  Server  should minimize the amount of processing required to send the response for this
        //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
        //   short delay before starting processing of a request during high traffic conditions.

        const shortDelay = 100; // milliseconds
        setTimeout(() => {
            const request = message.request;
            assert(request.schema.name === "FindServersRequest");
            if (!(request instanceof FindServersRequest)) {
                throw new Error("Invalid request type");
            }

            let servers = this.getServers(channel);
            // apply filters
            // TODO /
            if (request.serverUris && request.serverUris.length > 0) {
                // A serverUri matches the applicationUri from the ApplicationDescription define
                servers = servers.filter((inner_Server: ApplicationDescription) => {
                    return request.serverUris!.indexOf(inner_Server.applicationUri) >= 0;
                });
            }

            function adapt(applicationDescription: ApplicationDescription): ApplicationDescription {
                return new ApplicationDescription({
                    applicationName: applicationDescription.applicationName,
                    applicationType: applicationDescription.applicationType,
                    applicationUri: applicationDescription.applicationUri,
                    discoveryProfileUri: applicationDescription.discoveryProfileUri,
                    discoveryUrls: applicationDescription.discoveryUrls,
                    gatewayServerUri: applicationDescription.gatewayServerUri,
                    productUri: applicationDescription.productUri
                });
            }

            const response = new FindServersResponse({
                servers: servers.map(adapt)
            });

            channel.send_response("MSG", response, message, emptyCallback);
        }, shortDelay);
    }

    /**
     * returns a array of currently active channels
     */
    protected getChannels(): ServerSecureChannelLayer[] {
        let channels: ServerSecureChannelLayer[] = [];

        for (const endpoint of this.endpoints) {
            const c = endpoint.getChannels();
            channels = channels.concat(c);
        }
        return channels;
    }
}

/**
 * construct a service Fault response
 * @method makeServiceFault
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode: StatusCode, messages: string[]): ServiceFault {
    const response = new ServiceFault();
    response.responseHeader.serviceResult = statusCode;
    // xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    assert(Array.isArray(messages));
    assert(typeof messages[0] === "string");

    response.responseHeader.stringTable = messages;
    // tslint:disable:no-console
    warningLog(chalk.cyan(" messages "), messages.join("\n"));
    return response;
}

// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
OPCUABaseServer.prototype.resumeEndPoints = thenify.withCallback(OPCUABaseServer.prototype.resumeEndPoints, opts);
OPCUABaseServer.prototype.suspendEndPoints = thenify.withCallback(OPCUABaseServer.prototype.suspendEndPoints, opts);
OPCUABaseServer.prototype.shutdownChannels = thenify.withCallback(OPCUABaseServer.prototype.shutdownChannels, opts);
