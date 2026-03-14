/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import fs from "node:fs";
import os from "node:os";
import path from "node:path";


import { withLock } from "@ster5/global-mutex";
import async from "async";
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { getDefaultCertificateManager, makeSubject, type OPCUACertificateManager } from "node-opcua-certificate-manager";
import { performCertificateSanityCheck } from "node-opcua-client";
import { type IOPCUASecureObjectOptions, makeApplicationUrn, OPCUASecureObject } from "node-opcua-common";
import { exploreCertificate } from "node-opcua-crypto/web";
import { coerceLocalizedText } from "node-opcua-data-model";
import { installPeriodicClockAdjustment, uninstallPeriodicClockAdjustment } from "node-opcua-date-time";
import { checkDebugFlag, displayTraceFromThisProjectOnly, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import {
    extractFullyQualifiedDomainName,
    getFullyQualifiedDomainName,
    getHostname,
    resolveFullyQualifiedDomainName
} from "node-opcua-hostname";
import type { Message, Response, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { FindServersRequest, FindServersResponse } from "node-opcua-service-discovery";
import { ApplicationDescription, ApplicationType, GetEndpointsResponse } from "node-opcua-service-endpoints";
import { ServiceFault } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { ApplicationDescriptionOptions, EndpointDescription, GetEndpointsRequest } from "node-opcua-types";
import { checkFileExistsAndIsNotEmpty, matchUri } from "node-opcua-utils";
import type { IChannelData } from "./i_channel_data";
import type { ISocketData } from "./i_socket_data";
import type { OPCUAServerEndPoint } from "./server_end_point";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

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
    protected _preInitTask: (() => Promise<void>)[];

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

        this.serverInfo.applicationName.locale = this.serverInfo.applicationName.locale || "en";

        if (!this.serverInfo.applicationName.locale) {
            warningLog(
                "[NODE-OPCUA-W24] the server applicationName must have a valid locale : ",
                this.serverInfo.applicationName.toString()
            );
        }

        const __applicationUri = serverInfo.applicationUri || "";

        Object.defineProperty(this.serverInfo, "applicationUri", {
            get: () => resolveFullyQualifiedDomainName(__applicationUri),
            configurable: true
        });

        this._preInitTask.push(async () => {
            await extractFullyQualifiedDomainName();
        });

        this._preInitTask.push(async () => {
            await this.initializeCM();
        });
    }

    /**
     * Return additional DNS hostnames to include in the self-signed
     * certificate's SubjectAlternativeName (SAN).
     *
     * The base implementation returns an empty array. Subclasses
     * (e.g. `OPCUAServer`) override this to include hostnames from
     * `alternateHostname` and `advertisedEndpoints`.
     *
     * @internal
     */
    protected getConfiguredHostnames(): string[] {
        return [];
    }

    protected async createDefaultCertificate(): Promise<void> {
        if (fs.existsSync(this.certificateFile)) {
            return;
        }

        if (!checkFileExistsAndIsNotEmpty(this.certificateFile)) {
            await withLock({ fileToLock: `${this.certificateFile}.mutex` }, async () => {
                if (checkFileExistsAndIsNotEmpty(this.certificateFile)) {
                    return;
                }
                const applicationUri = this.serverInfo.applicationUri || "<missing application uri>";
                const fqdn = getFullyQualifiedDomainName();
                const hostname = getHostname();
                const dns = [...new Set([fqdn, hostname, ...this.getConfiguredHostnames()])].sort();

                await this.serverCertificateManager.createSelfSignedCertificate({
                    applicationUri,
                    dns,
                    // ip: await getIpAddresses(),
                    outputFile: this.certificateFile,

                    subject: makeSubject(this.serverInfo.applicationName.text || "<missing application name>", hostname),

                    startDate: new Date(),
                    validity: 365 * 10 // 10 years
                });
            });
        }
    }

    public async initializeCM(): Promise<void> {
        await this.serverCertificateManager.initialize();
        await this.createDefaultCertificate();
        debugLog("privateKey      = ", this.privateKeyFile, this.serverCertificateManager.privateKey);
        debugLog("certificateFile = ", this.certificateFile);
        this._checkCertificateSanMismatch();
        await performCertificateSanityCheck(this, "server", this.serverCertificateManager, this.serverInfo.applicationUri || "");
    }

    /**
     * Compare the current certificate's SAN DNS entries against all
     * configured hostnames and return any names that are missing.
     *
     * Returns an empty array when the certificate covers every
     * configured hostname.
     */
    public checkCertificateSAN(): string[] {
        const certDer = this.getCertificate();
        const info = exploreCertificate(certDer);
        const sanDns: string[] = info.tbsCertificate.extensions?.subjectAltName?.dNSName || [];

        const fqdn = getFullyQualifiedDomainName();
        const hostname = getHostname();
        const expected = [...new Set([fqdn, hostname, ...this.getConfiguredHostnames()])].sort();

        return expected.filter((name) => !sanDns.includes(name));
    }

    /**
     * Delete the existing self-signed certificate and create a new
     * one that includes all currently configured hostnames.
     *
     * @throws if the current certificate was NOT self-signed
     *         (i.e. issued by a CA or GDS)
     */
    public async regenerateSelfSignedCertificate(): Promise<void> {
        // guard: only allow regeneration of self-signed certs
        const certDer = this.getCertificate();
        const info = exploreCertificate(certDer);
        const issuer = info.tbsCertificate.issuer;
        const subject = info.tbsCertificate.subject;
        const isSelfSigned =
            issuer.commonName === subject.commonName &&
            issuer.organizationName === subject.organizationName;
        if (!isSelfSigned) {
            throw new Error(
                "Cannot regenerate certificate: current certificate is not self-signed (issued by a CA or GDS)"
            );
        }

        // delete old cert
        if (fs.existsSync(this.certificateFile)) {
            fs.unlinkSync(this.certificateFile);
        }
        // recreate with current hostnames
        await this.createDefaultCertificate();
        // invalidate cached cert so next getCertificate() reloads from disk
        const priv = this as unknown as { $$certificate: null; $$certificateChain: null };
        priv.$$certificate = null;
        priv.$$certificateChain = null;
    }

    private _checkCertificateSanMismatch(): void {
        try {
            const missing = this.checkCertificateSAN();
            if (missing.length > 0) {
                warningLog(
                    `[NODE-OPCUA-W26] Certificate SAN is missing the following configured hostnames: ${missing.join(", ")}. ` +
                    "Clients with strict certificate validation may reject connections from these hostnames. " +
                    "Use server.regenerateSelfSignedCertificate() to fix this."
                );
            }
        } catch (_err) {
            // ignore errors during SAN check (e.g. cert not yet loaded)
        }
    }

    /**
     * start all registered endPoint, in parallel, and call done when all endPoints are listening.
     */
    public start(): Promise<void>;
    public start(done: () => void): void;
    public start(...args: [((err?: Error) => void)?]): Promise<void> | void {
        const callback = args[0];
        if (!callback || args.length === 0) {
            return this.startAsync();
        } else {
            this.startAsync()
                .then(() => {
                    callback();
                })
                .catch((err) => callback(err));
        }
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
     */
    public shutdown(done: (err?: Error | null) => void): void {
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
                    done(err);
                }
            );
        });
    }

    public async shutdownChannels(): Promise<void>;
    public shutdownChannels(callback: (err?: Error | null) => void): void;
    public shutdownChannels(callback?: (err?: Error | null) => void): Promise<void> | void {
        assert(typeof callback === "function");
        // c8 ignore next
        if (!callback) throw new Error("thenify is not available");
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
            callback
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
            channel._on_response = (_msg: string, response1: Response /*, inner_message: Message*/) => {
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
            const handler = (this as unknown as Record<string, unknown>)[`_on_${request.schema.name}`];
            if (typeof handler === "function") {
                handler.call(this, message, channel);
            } else {
                errMessage = `[NODE-OPCUA-W07] Unsupported Service : ${request.schema.name}`;
                warningLog(errMessage);
                debugLog(chalk.red.bold(errMessage));
                response = makeServiceFault(StatusCodes.BadServiceUnsupported, [errMessage]);
                channel.send_response("MSG", response, message, emptyCallback);
            }
        } catch (err) {
            /* c8 ignore next */
            const errMessage1 = `[NODE-OPCUA-W08] EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ${request.schema.name}`;
            warningLog(chalk.red.bold(errMessage1));
            warningLog(request.toString());
            displayTraceFromThisProjectOnly(err as Error);

            let additional_messages = [];
            additional_messages.push(`EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! ${request.schema.name}`);
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
     * Find endpoint descriptions matching a given endpoint URL.
     *
     * When `endpointUrl` is provided, only endpoints whose URL matches
     * (case-insensitive) are returned. When `null` or omitted, all
     * endpoints from every `OPCUAServerEndPoint` are returned.
     *
     * This is the shared resolution path used by both `GetEndpoints`
     * and `CreateSession` (`validate_security_endpoint`).
     *
     * @internal (was _get_endpoints)
     */
    public findMatchingEndpoints(endpointUrl?: string | null): EndpointDescription[] {
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
        return this.findMatchingEndpoints()[0].endpointUrl || "";
    }

    public getDiscoveryUrls(): string[] {
        const discoveryUrls = this.endpoints.map((e: OPCUAServerEndPoint) => {
            return e.endpointDescriptions()[0].endpointUrl || "";
        });
        return discoveryUrls;
    }

    public getServers(_channel: ServerSecureChannelLayer): ApplicationDescription[] {
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
    public suspendEndPoints(callback: (err?: Error | null) => void): void;
    public suspendEndPoints(callback?: (err?: Error | null) => void): void | Promise<void> {
        /* c8 ignore next */
        if (!callback) {
            throw new Error("Internal Error");
        }
        async.forEach(
            this.endpoints,
            (ep: OPCUAServerEndPoint, _inner_callback) => {
                /* c8 ignore next */
                if (doDebug) {
                    debugLog("Suspending ", ep.endpointDescriptions()[0].endpointUrl);
                }

                ep.suspendConnection((err?: Error | null) => {
                    /* c8 ignore next */
                    if (doDebug) {
                        debugLog("Suspended ", ep.endpointDescriptions()[0].endpointUrl);
                    }
                    _inner_callback(err);
                });
            },
            (err?: Error | null) => callback(err)
        );
    }

    /**
     * set all the end point into a state where they do accept connections
     * note:
     *    this method is useful for testing purpose
     */
    public async resumeEndPoints(): Promise<void>;
    public resumeEndPoints(callback: (err?: Error | null) => void): void;
    public resumeEndPoints(callback?: (err?: Error | null) => void): void | Promise<void> {
        // c8 ignore next
        if (!callback) throw new Error("thenify is not available");
        async.forEach(
            this.endpoints,
            (ep: OPCUAServerEndPoint, _inner_callback) => {
                ep.restoreConnection(_inner_callback);
            },
            (err?: Error | null) => callback(err)
        );
    }

    protected prepare(_message: Message, _channel: ServerSecureChannelLayer): void {
        /* empty */
    }

    /**
     * @private
     */
    protected _on_GetEndpointsRequest(message: Message, channel: ServerSecureChannelLayer): void {
        const request = message.request as GetEndpointsRequest;

        assert(request.schema.name === "GetEndpointsRequest");

        const response = new GetEndpointsResponse({});

        /**
         * endpointUrl	String	The network address that the Client used to access the DiscoveryEndpoint.
         *                      The Server uses this information for diagnostics and to determine what URLs to return in the response.
         *                      The Server should return a suitable default URL if it does not recognize the HostName in the URL
         * localeIds   []LocaleId	List of locales to use.
         *                          Specifies the locale to use when returning human readable strings.
         * profileUris []	String	List of Transport Profile that the returned Endpoints shall support.
         *                          OPC 10000-7 defines URIs for the Transport Profiles.
         *                          All Endpoints are returned if the list is empty.
         *                          If the URI is a URL, this URL may have a query string appended.
         *                          The Transport Profiles that support query strings are defined in OPC 10000-7.
         */
        response.endpoints = this.findMatchingEndpoints(null);
        const _e = response.endpoints.map((e) => e.endpointUrl);
        if (request.endpointUrl) {
            const filtered = response.endpoints.filter(
                (endpoint: EndpointDescription) => endpoint.endpointUrl === request.endpointUrl
            );
            if (filtered.length > 0) {
                response.endpoints = filtered;
            }
        }
        response.endpoints = response.endpoints.filter(
            (endpoint: EndpointDescription) => !(endpoint as unknown as { restricted: boolean }).restricted
        );

        // apply filters
        if (request.profileUris && request.profileUris.length > 0) {
            const profileUris = request.profileUris;
            response.endpoints = response.endpoints.filter(
                (endpoint: EndpointDescription) => profileUris.indexOf(endpoint.transportProfileUri) >= 0
            );
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
                const serverUris = request.serverUris;
                // A serverUri matches the applicationUri from the ApplicationDescription define
                servers = servers.filter((inner_Server: ApplicationDescription) => {
                    return serverUris.indexOf(inner_Server.applicationUri) >= 0;
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
import { withCallback } from "thenify-ex";

const opts = { multiArgs: false };
OPCUABaseServer.prototype.resumeEndPoints = withCallback(OPCUABaseServer.prototype.resumeEndPoints, opts);
OPCUABaseServer.prototype.suspendEndPoints = withCallback(OPCUABaseServer.prototype.suspendEndPoints, opts);
OPCUABaseServer.prototype.shutdownChannels = withCallback(OPCUABaseServer.prototype.shutdownChannels, opts);
