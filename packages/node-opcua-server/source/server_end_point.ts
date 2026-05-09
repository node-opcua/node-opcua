/* eslint-disable max-statements */
/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import { EventEmitter } from "node:events";
import net, { type Server, type Socket } from "node:net";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { type ICertificateChainProvider, type ICertificateStore, StaticCertificateChainProvider } from "node-opcua-common";
import { type Certificate, combine_der, makeSHA1Thumbprint, type PrivateKey, split_der } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { getFullyQualifiedDomainName, resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import {
    fromURI,
    type IServerSessionBase,
    type Message,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    type ServerSecureChannelParent,
    toURI
} from "node-opcua-secure-channel";
import { ApplicationDescription, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import type { StatusCode } from "node-opcua-status-code";
import type { IHelloAckLimits } from "node-opcua-transport";
import type { UserTokenPolicyOptions } from "node-opcua-types";

import type { IChannelData } from "./i_channel_data";
import type { ISocketData } from "./i_socket_data";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

const UATCP_UASC_UABINARY = "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";

function extractSocketData(socket: net.Socket, reason: string): ISocketData {
    const { bytesRead, bytesWritten, remoteAddress, remoteFamily, remotePort, localAddress, localPort } = socket;
    const data: ISocketData = {
        bytesRead,
        bytesWritten,
        localAddress,
        localPort,
        remoteAddress,
        remoteFamily,
        remotePort,
        timestamp: new Date(),
        reason
    };
    return data;
}

function extractChannelData(channel: ServerSecureChannelLayer): IChannelData {
    const { channelId, clientCertificate, securityMode, securityPolicy, timeout, transactionsCount } = channel;

    const channelData: IChannelData = {
        channelId,
        clientCertificate,
        securityMode,
        securityPolicy,
        timeout,
        transactionsCount
    };
    return channelData;
}

function dumpChannelInfo(channels: ServerSecureChannelLayer[]): void {
    function d(s: IServerSessionBase) {
        return `[ status=${s.status} lastSeen=${s.clientLastContactTime.toFixed(0)}ms sessionName=${s.sessionName} timeout=${s.sessionTimeout
            } ]`;
    }
    function dumpChannel(channel: ServerSecureChannelLayer): void {
        console.log("------------------------------------------------------");
        console.log("            channelId = ", channel.channelId);
        console.log("             timeout  = ", channel.timeout);
        console.log("        remoteAddress = ", channel.remoteAddress);
        console.log("        remotePort    = ", channel.remotePort);
        console.log("");
        console.log("        bytesWritten  = ", channel.bytesWritten);
        console.log("        bytesRead     = ", channel.bytesRead);
        console.log("        sessions      = ", Object.keys(channel.sessionTokens).length);
        console.log(Object.values(channel.sessionTokens).map(d).join("\n"));

        // biome-ignore lint/suspicious/noExplicitAny: accessing internal transport for debug dump
        const socket = (channel as any).transport?._socket;
        if (!socket) {
            console.log(" SOCKET IS CLOSED");
        }
    }

    for (const channel of channels) {
        dumpChannel(channel);
    }
    console.log("------------------------------------------------------");
}

const emptyCertificateChain: Certificate[] = [];

// biome-ignore lint/suspicious/noExplicitAny: deliberate null→PrivateKey sentinel
const emptyPrivateKey = null as any as PrivateKey;

let OPCUAServerEndPointCounter = 0;

export interface OPCUAServerEndPointOptions {
    /**
     * the tcp port
     */
    port: number;
    /**
     * the tcp host
     */
    host?: string;
    /**
     * the DER certificate chain
     */
    certificateChain: Certificate[];

    /**
     * privateKey
     */
    privateKey: PrivateKey;

    certificateManager: ICertificateStore;

    /**
     *  the default secureToken lifetime @default=60000
     */
    defaultSecureTokenLifetime?: number;

    /**
     * the maximum number of connection allowed on the TCP server socket
     * @default 20
     */
    maxConnections?: number;

    /**
     *  the  timeout for the TCP HEL/ACK transaction (in ms)
     *  @default 30000
     */
    timeout?: number;

    serverInfo: ApplicationDescription;

    objectFactory?: unknown;

    transportSettings?: IServerTransportSettings;
}

export interface IServerTransportSettings {
    adjustTransportLimits: (hello: IHelloAckLimits) => IHelloAckLimits;
}

export interface EndpointDescriptionParams {
    restricted?: boolean;
    allowUnsecurePassword?: boolean;
    resourcePath?: string;
    alternateHostname?: string[];
    hostname: string;
    /**
     * Override the port used in the endpoint URL.
     * When set, the endpoint URL uses this port instead of the
     * server's listen port. The server does NOT listen on this port.
     * Useful for Docker port-mapping, reverse proxies, and NAT.
     */
    advertisedPort?: number;
    securityPolicies: SecurityPolicy[];
    userTokenTypes: UserTokenType[];
}

/**
 * Per-URL security overrides for advertised endpoints.
 *
 * When `advertisedEndpoints` contains a config object, the endpoint
 * descriptions generated for that URL use the overridden security
 * settings instead of inheriting from the main endpoint.
 *
 * Any field that is omitted falls back to the main endpoint's value.
 *
 * @example
 * ```ts
 * advertisedEndpoints: [
 *     // Public: SignAndEncrypt only, no anonymous
 *     {
 *         url: "opc.tcp://public.example.com:4840",
 *         securityModes: [MessageSecurityMode.SignAndEncrypt],
 *         allowAnonymous: false
 *     },
 *     // Internal: inherits everything from main endpoint
 *     "opc.tcp://internal:48480"
 * ]
 * ```
 */
export interface AdvertisedEndpointConfig {
    /** The full endpoint URL, e.g. `"opc.tcp://public.example.com:4840"` */
    url: string;
    /** Override security modes (default: inherit from main endpoint) */
    securityModes?: MessageSecurityMode[];
    /** Override security policies (default: inherit from main endpoint) */
    securityPolicies?: SecurityPolicy[];
    /** Override anonymous access (default: inherit from main endpoint) */
    allowAnonymous?: boolean;
    /** Override user token types (default: inherit from main endpoint) */
    userTokenTypes?: UserTokenType[];
}

/**
 * An advertised endpoint entry — either a plain URL string (inherits
 * all settings from the main endpoint) or a config object with
 * per-URL security overrides.
 */
export type AdvertisedEndpoint = string | AdvertisedEndpointConfig;

/**
 * Normalize any `advertisedEndpoints` input into a uniform
 * `AdvertisedEndpointConfig[]`.
 *
 * This coercion is done early so that all downstream code
 * (endpoint generation, IP/hostname extraction) only deals
 * with one type.
 */
export function normalizeAdvertisedEndpoints(raw?: AdvertisedEndpoint | AdvertisedEndpoint[]): AdvertisedEndpointConfig[] {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((entry) => (typeof entry === "string" ? { url: entry } : entry));
}

export interface AddStandardEndpointDescriptionsParam {
    allowAnonymous?: boolean;
    disableDiscovery?: boolean;
    securityModes?: MessageSecurityMode[];

    restricted?: boolean;
    allowUnsecurePassword?: boolean;
    resourcePath?: string;
    alternateHostname?: string[];
    hostname?: string;
    securityPolicies?: SecurityPolicy[];
    userTokenTypes?: UserTokenType[];

    /**
     * Additional endpoint URL(s) to advertise.
     *
     * Use when the server is behind Docker port-mapping,
     * a reverse proxy, or a NAT gateway.
     *
     * Each entry can be a plain URL string (inherits all security
     * settings from the main endpoint) or an
     * `AdvertisedEndpointConfig` object with per-URL overrides.
     *
     * The server still listens on `port` — these are purely
     * advertised aliases.
     *
     * @example Simple string (inherits main settings)
     * ```ts
     * advertisedEndpoints: "opc.tcp://localhost:48481"
     * ```
     *
     * @example Mixed array with per-URL security overrides
     * ```ts
     * advertisedEndpoints: [
     *     "opc.tcp://internal:48480",
     *     {
     *         url: "opc.tcp://public.example.com:4840",
     *         securityModes: [MessageSecurityMode.SignAndEncrypt],
     *         allowAnonymous: false
     *     }
     * ]
     * ```
     */
    advertisedEndpoints?: AdvertisedEndpoint | AdvertisedEndpoint[];
}

/**
 * Parse an `opc.tcp://hostname:port` URL and extract hostname and port.
 * @internal
 */
export function parseOpcTcpUrl(url: string): { hostname: string; port: number } {
    // URL class doesn't understand opc.tcp://, so swap to http://
    const httpUrl = url.replace(/^opc\.tcp:\/\//i, "http://");
    const parsed = new URL(httpUrl);
    return {
        hostname: parsed.hostname,
        port: parsed.port ? Number.parseInt(parsed.port, 10) : 4840
    };
}

function getUniqueName(name: string, collection: { [key: string]: number }) {
    if (collection[name]) {
        let counter = 0;
        while (collection[`${name}_${counter.toString()}`]) {
            counter++;
        }
        name = `${name}_${counter.toString()}`;
        collection[name] = 1;
        return name;
    } else {
        collection[name] = 1;
        return name;
    }
}

/**
 * Stores the abort listener for channels in the pre-registration phase.
 * Using a WeakMap instead of monkey-patching the channel object keeps
 * this internal state invisible to debuggers and external code.
 */
const preregisterAbortListeners = new WeakMap<ServerSecureChannelLayer, () => void>();
/**
 * OPCUAServerEndPoint a Server EndPoint.
 * A sever end point is listening to one port
 * note:
 *   see OPCUA Release 1.03 part 4 page 108 7.1 ApplicationDescription
 */
export class OPCUAServerEndPoint extends EventEmitter implements ServerSecureChannelParent {
    /**
     * the tcp port
     */
    public port: number;
    public host: string | undefined;
    public certificateManager: ICertificateStore;
    public defaultSecureTokenLifetime: number;
    public maxConnections: number;
    public timeout: number;
    public bytesWrittenInOldChannels: number;
    public bytesReadInOldChannels: number;
    public transactionsCountOldChannels: number;
    public securityTokenCountOldChannels: number;
    public serverInfo: ApplicationDescription;
    public objectFactory: unknown;

    public _on_new_channel?: (channel: ServerSecureChannelLayer) => void;
    public _on_channel_secured?: (channel: ServerSecureChannelLayer) => void;
    public _on_close_channel?: (channel: ServerSecureChannelLayer) => void;
    public _on_connectionRefused?: (socketData: ISocketData) => void;
    public _on_openSecureChannelFailure?: (socketData: ISocketData, channelData: IChannelData) => void;

    /**
     * Optional callback to adjust the certificate status code
     * during OpenSecureChannel.
     *
     * When set (typically by `installPushCertificateManagementOnServer`),
     * this callback is invoked whenever the base certificate check
     * returns a non-Good status. It can choose to relax certain
     * errors (e.g. untrusted/missing-CRL) based on application
     * policy such as the server being in NoConfiguration state.
     */
    public onAdjustCertificateStatus?: (
        statusCode: StatusCode,
        certificate: Certificate
    ) => StatusCode | Promise<StatusCode>;

    /**
     * Implements `ServerSecureChannelParent.adjustCertificateStatus`.
     * Delegates to the `onAdjustCertificateStatus` callback if set.
     */
    public adjustCertificateStatus(
        statusCode: StatusCode,
        certificate: Certificate
    ): StatusCode | Promise<StatusCode> {
        if (this.onAdjustCertificateStatus) {
            return this.onAdjustCertificateStatus(statusCode, certificate);
        }
        return statusCode;
    }

    /**
     * Certificate chain provider — delegates all cert/key access.
     * Stored in a `#` private field so secrets are not visible
     * in the debugger's property list or JSON serialization.
     */
    #certProvider: ICertificateChainProvider;
    /**
     * Combined DER cache — invalidated whenever the cert provider
     * changes so that `EndpointDescription.serverCertificate`
     * getters don't call `combine_der()` on every access.
     */
    #combinedDerCache: Certificate | undefined;
    private _channels: { [key: string]: ServerSecureChannelLayer };
    private _server?: Server;
    private _endpoints: EndpointDescription[];
    private _listen_callback?: (err?: Error) => void;
    private _started = false;
    private _counter = OPCUAServerEndPointCounter++;
    private _policy_deduplicator: { [key: string]: number } = {};

    private transportSettings?: IServerTransportSettings;
    constructor(options: OPCUAServerEndPointOptions) {
        super();

        assert(!Object.hasOwn(options, "certificate"), "expecting a certificateChain instead");
        assert(Object.hasOwn(options, "certificateChain"), "expecting a certificateChain");
        assert(Object.hasOwn(options, "privateKey"));

        this.certificateManager = options.certificateManager;

        options.port = options.port || 0;

        this.port = parseInt(options.port.toString(), 10);
        this.host = options.host;
        assert(typeof this.port === "number");

        this.#certProvider = new StaticCertificateChainProvider(options.certificateChain, options.privateKey);

        this._channels = {};

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;

        this.maxConnections = options.maxConnections || 20;

        this.timeout = options.timeout || 30000;

        this._server = undefined;

        this._setup_server();

        this._endpoints = [];

        this.objectFactory = options.objectFactory;

        this.bytesWrittenInOldChannels = 0;
        this.bytesReadInOldChannels = 0;
        this.transactionsCountOldChannels = 0;
        this.securityTokenCountOldChannels = 0;

        this.serverInfo = options.serverInfo;
        assert(this.serverInfo !== null && typeof this.serverInfo === "object");

        this.transportSettings = options.transportSettings;
    }

    public dispose(): void {
        this.#certProvider = new StaticCertificateChainProvider(emptyCertificateChain, emptyPrivateKey);
        this.#combinedDerCache = undefined;

        assert(Object.keys(this._channels).length === 0, "OPCUAServerEndPoint channels must have been deleted");

        this._channels = {};
        this.serverInfo = new ApplicationDescription({});

        this._endpoints = [];
        assert(this._endpoints.length === 0, "endpoints must have been deleted");
        this._endpoints = [];

        this._server = undefined;
        this._listen_callback = undefined;

        this.removeAllListeners();
    }

    public toString(): string {
        const txt =
            " end point" +
            this._counter +
            " port = " +
            this.port +
            " l = " +
            this._endpoints.length +
            " " +
            makeSHA1Thumbprint(this.getCertificate()).toString("hex");
        return txt;
    }

    public toJSON(): Record<string, unknown> {
        return {
            port: this.port,
            host: this.host,
            maxConnections: this.maxConnections,
            timeout: this.timeout,
            currentChannelCount: this.currentChannelCount,
            endpointDescriptions: this._endpoints.map(e => e.endpointUrl)
        };
    }

    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return this.toString();
    }

    public getChannels(): ServerSecureChannelLayer[] {
        return Object.values(this._channels);
    }

    /**
     * Returns the X509 DER form of the server certificate
     */
    public getCertificate(): Certificate {
        return this.getCertificateChain()[0];
    }

    /**
     * Returns the X509 DER form of the server certificate
     */
    public getCertificateChain(): Certificate[] {
        return this.#certProvider.getCertificateChain();
    }

    /**
     * Replace the certificate chain provider for this endpoint.
     *
     * Used by push certificate management to switch from the
     * default static provider to a disk-based one that re-reads
     * certificates on demand.
     *
     * Invalidates the cached `combine_der` result so that
     * `EndpointDescription.serverCertificate` getters pick up
     * the new chain immediately.
     */
    public setCertificateProvider(provider: ICertificateChainProvider): void {
        this.#certProvider = provider;
        this.#combinedDerCache = undefined;
    }

    /**
     * Return the current certificate chain provider.
     * Useful for calling `invalidate()` after certificate rotation.
     */
    public getCertificateProvider(): ICertificateChainProvider {
        return this.#certProvider;
    }

    /**
     * Invalidate the combined DER cache.
     *
     * Called after the underlying provider's chain changes
     * (e.g. after `provider.invalidate()` or `provider.update()`).
     * The next `EndpointDescription.serverCertificate` access
     * will recompute the combined DER from the provider.
     */
    public invalidateCombinedDerCache(): void {
        this.#combinedDerCache = undefined;
    }

    /**
     * Convenience method: invalidate both the provider's cache
     * (so it re-reads from disk) and the combined DER cache
     * (so endpoint descriptions recompute `serverCertificate`).
     *
     * Prefer this over calling `getCertificateProvider().invalidate()`
     * and `invalidateCombinedDerCache()` separately.
     */
    public invalidateCertificates(): void {
        this.#certProvider.invalidate();
        this.#combinedDerCache = undefined;
    }

    /**
     * Get the combined DER certificate (all certs concatenated)
     * for use in EndpointDescription.serverCertificate.
     * Cached internally; invalidated by provider changes.
     * @internal
     */
    public getCombinedCertificate(): Certificate | undefined {
        const chain = this.#certProvider.getCertificateChain();
        if (chain.length === 0) return undefined;
        if (!this.#combinedDerCache) {
            this.#combinedDerCache = combine_der(chain);
        }
        return this.#combinedDerCache;
    }

    /**
     * the private key
     */
    public getPrivateKey(): PrivateKey {
        return this.#certProvider.getPrivateKey();
    }

    /**
     * The number of active channel on this end point.
     */
    public get currentChannelCount(): number {
        return Object.keys(this._channels).length;
    }

    /**
     */
    public getEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        endpointUrl: string | null
    ): EndpointDescription | null {
        const endpoints = this.endpointDescriptions();
        const arr = endpoints.filter(matching_endpoint.bind(this, securityMode, securityPolicy, endpointUrl));

        if (endpointUrl && endpointUrl.length > 0 && !(arr.length === 0 || arr.length === 1)) {
            errorLog("Several matching endpoints have been found : ");
            for (const a of arr) {
                errorLog("   ", a.endpointUrl, MessageSecurityMode[securityMode], securityPolicy);
            }
        }
        return arr.length === 0 ? null : arr[0];
    }

    public addEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        options: EndpointDescriptionParams
    ): void {
        // c8 ignore next
        if (securityMode === MessageSecurityMode.None && securityPolicy !== SecurityPolicy.None) {
            throw new Error(" invalid security ");
        }
        // c8 ignore next
        if (securityMode !== MessageSecurityMode.None && securityPolicy === SecurityPolicy.None) {
            throw new Error(" invalid security ");
        }
        //

        // resource Path is a string added at the end of the url such as "/UA/Server"
        const resourcePath = (options.resourcePath || "").replace(/\\/g, "/");

        assert(resourcePath.length === 0 || resourcePath.charAt(0) === "/", "resourcePath should start with /");

        const hostname = options.hostname || getFullyQualifiedDomainName();
        const effectivePort = options.advertisedPort ?? this.port;
        const endpointUrl = `opc.tcp://${hostname}:${effectivePort}${resourcePath}`;

        const endpoint_desc = this.getEndpointDescription(securityMode, securityPolicy, endpointUrl);

        // c8 ignore next
        if (endpoint_desc) {
            throw new Error(" endpoint already exist");
        }

        const userTokenTypes = options.userTokenTypes;

        // now build endpointUrl
        this._endpoints.push(
            _makeEndpointDescription(
                {
                    collection: this._policy_deduplicator,
                    hostname,
                    server: this.serverInfo,

                    securityMode,
                    securityPolicy,

                    allowUnsecurePassword: options.allowUnsecurePassword,
                    resourcePath: options.resourcePath,

                    restricted: !!options.restricted,
                    securityPolicies: options.securityPolicies || [],

                    advertisedPort: options.advertisedPort,
                    userTokenTypes
                },
                this
            )
        );
    }

    public addRestrictedEndpointDescription(options: EndpointDescriptionParams): void {
        options = { ...options };
        options.restricted = true;
        this.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
    }

    public addStandardEndpointDescriptions(options?: AddStandardEndpointDescriptionsParam): void {
        options = options || {};

        options.securityModes = options.securityModes || defaultSecurityModes;
        options.securityPolicies = options.securityPolicies || defaultSecurityPolicies;
        options.userTokenTypes = options.userTokenTypes || defaultUserTokenTypes;

        options.allowAnonymous = options.allowAnonymous === undefined ? true : options.allowAnonymous;
        // make sure we do not have anonymous
        if (!options.allowAnonymous) {
            options.userTokenTypes = options.userTokenTypes.filter((r) => r !== UserTokenType.Anonymous);
        }

        const defaultHostname = options.hostname || getFullyQualifiedDomainName();

        let hostnames: string[] = [defaultHostname];

        options.alternateHostname = options.alternateHostname || [];
        if (typeof options.alternateHostname === "string") {
            options.alternateHostname = [options.alternateHostname];
        }
        // remove duplicates if any (uniq)
        hostnames = [...new Set(hostnames.concat(options.alternateHostname))];

        for (const alternateHostname of hostnames) {
            const optionsE: EndpointDescriptionParams = {
                hostname: alternateHostname,
                securityPolicies: options.securityPolicies,
                userTokenTypes: options.userTokenTypes,
                allowUnsecurePassword: options.allowUnsecurePassword,
                alternateHostname: options.alternateHostname,
                resourcePath: options.resourcePath
            };

            if (options.securityModes.indexOf(MessageSecurityMode.None) >= 0) {
                this.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, optionsE);
            } else {
                if (!options.disableDiscovery) {
                    this.addRestrictedEndpointDescription(optionsE);
                }
            }
            for (const securityMode of options.securityModes) {
                if (securityMode === MessageSecurityMode.None) {
                    continue;
                }
                for (const securityPolicy of options.securityPolicies) {
                    if (securityPolicy === SecurityPolicy.None) {
                        continue;
                    }
                    this.addEndpointDescription(securityMode, securityPolicy, optionsE);
                }
            }
        }

        // ── Advertised endpoints (virtual — no TCP listener) ──────
        // Normalize to AdvertisedEndpointConfig[] so downstream code
        // only deals with one type.
        const advertisedList = normalizeAdvertisedEndpoints(options.advertisedEndpoints);

        // Main endpoint defaults (guaranteed non-null — assigned above)
        const mainSecurityModes = options.securityModes || defaultSecurityModes;
        const mainSecurityPolicies = options.securityPolicies || defaultSecurityPolicies;
        const mainUserTokenTypes = options.userTokenTypes || defaultUserTokenTypes;

        for (const config of advertisedList) {
            const { hostname: advHostname, port: advPort } = parseOpcTcpUrl(config.url);
            // Skip if this hostname+port combo was already covered
            // by the regular hostname loop (same hostname, same port)
            if (hostnames.some((h) => h.toLowerCase() === advHostname.toLowerCase()) && advPort === this.port) {
                continue;
            }

            // Per-URL security overrides — fall back to main settings
            const entrySecurityModes = config.securityModes ?? mainSecurityModes;
            const entrySecurityPolicies = config.securityPolicies ?? mainSecurityPolicies;
            let entryUserTokenTypes = config.userTokenTypes ?? mainUserTokenTypes;

            // Handle allowAnonymous override: if explicitly false,
            // filter out Anonymous even if the main config allows it
            if (config.allowAnonymous === false) {
                entryUserTokenTypes = entryUserTokenTypes.filter((t) => t !== UserTokenType.Anonymous);
            }

            const optionsE: EndpointDescriptionParams = {
                hostname: advHostname,
                advertisedPort: advPort,
                securityPolicies: entrySecurityPolicies,
                userTokenTypes: entryUserTokenTypes,
                allowUnsecurePassword: options.allowUnsecurePassword,
                alternateHostname: options.alternateHostname,
                resourcePath: options.resourcePath
            };

            if (entrySecurityModes.indexOf(MessageSecurityMode.None) >= 0) {
                this.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, optionsE);
            } else {
                if (!options.disableDiscovery) {
                    this.addRestrictedEndpointDescription(optionsE);
                }
            }
            for (const securityMode of entrySecurityModes) {
                if (securityMode === MessageSecurityMode.None) {
                    continue;
                }
                for (const securityPolicy of entrySecurityPolicies) {
                    if (securityPolicy === SecurityPolicy.None) {
                        continue;
                    }
                    this.addEndpointDescription(securityMode, securityPolicy, optionsE);
                }
            }
        }
    }

    /**
     * returns the list of end point descriptions.
     */
    public endpointDescriptions(): EndpointDescription[] {
        return this._endpoints;
    }

    /**
     */
    public listen(callback: (err?: Error) => void): void {
        assert(typeof callback === "function");
        assert(!this._started, "OPCUAServerEndPoint is already listening");

        if (!this._server) {
            callback(new Error("Server is not initialized"));
            return;
        }

        this._listen_callback = callback;

        this._server.on("error", (err: Error) => {
            debugLog(`${chalk.red.bold(" error")} port = ${this.port}`, err);
            this._started = false;
            this._end_listen(err);
        });
        this._server.on("listening", () => {
            debugLog("server is listening");
        });

        const listenOptions: net.ListenOptions = {
            port: this.port,
            host: this.host
        };

        this._server.listen(
            listenOptions,
            /*"::",*/(err?: Error) => {
                // 'listening' listener
                debugLog(chalk.green.bold("LISTENING TO PORT "), this.port, "err  ", err);
                assert(!err, " cannot listen to port ");
                this._started = true;
                if (!this.port) {
                    const add = this._server?.address();
                    this.port = typeof add !== "string" ? add?.port || 0 : this.port;
                }
                this._end_listen();
            }
        );
    }

    public killClientSockets(callback: (err?: Error) => void): void {
        for (const channel of this.getChannels()) {
            const hacked_channel = channel as unknown as {
                transport: { _socket: { destroy: () => void; emit: (event: string, err: Error) => void } };
            };
            if (hacked_channel.transport?._socket) {
                // hacked_channel.transport._socket.close();
                hacked_channel.transport._socket.destroy();
                hacked_channel.transport._socket.emit("error", new Error("EPIPE"));
            }
        }
        callback();
    }

    public suspendConnection(callback: (err?: Error) => void): void {
        if (!this._started || !this._server) {
            callback(new Error("Connection already suspended !!"));
            return;
        }

        // Stops the server from accepting new connections and keeps existing connections.
        // (note from nodejs doc: This function is asynchronous, the server is finally closed
        // when all connections are ended and the server emits a 'close' event.
        // The optional callback will be called once the 'close' event occurs.
        // Unlike that event, it will be called with an Error as its only argument
        // if the server was not open when it was closed.
        this._server.close(() => {
            this._started = false;
            debugLog(`Connection has been closed !${this.port}`);
        });
        this._started = false;
        callback();
    }

    public restoreConnection(callback: (err?: Error) => void): void {
        this.listen(callback);
    }

    public abruptlyInterruptChannels(): void {
        for (const channel of Object.values(this._channels)) {
            channel.abruptlyInterrupt();
        }
    }

    /**
     */
    public shutdown(callback: (err?: Error) => void): void {
        debugLog("OPCUAServerEndPoint#shutdown ");

        if (this._started) {
            // make sure we don't accept new connection any more ...
            this.suspendConnection(() => {
                // shutdown all opened channels ...
                const _channels = Object.values(this._channels);
                const promises = _channels.map(
                    (channel) =>
                        new Promise<void>((resolve, reject) => {
                            this.shutdown_channel(channel, (err?: Error) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        })
                );
                Promise.all(promises)
                    .then(() => {
                        /* c8 ignore next */
                        if (!(Object.keys(this._channels).length === 0)) {
                            errorLog(" Bad !");
                        }
                        assert(Object.keys(this._channels).length === 0, "channel must have unregistered themselves");
                        callback();
                    })
                    .catch((err) => {
                        callback(err);
                    });
            });
        } else {
            callback();
        }
    }

    /**
     */
    public start(callback: (err?: Error) => void): void {
        assert(typeof callback === "function");
        this.listen(callback);
    }

    public get bytesWritten(): number {
        const channels = Object.values(this._channels);
        return (
            this.bytesWrittenInOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.bytesWritten;
            }, 0)
        );
    }

    public get bytesRead(): number {
        const channels = Object.values(this._channels);
        return (
            this.bytesReadInOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.bytesRead;
            }, 0)
        );
    }

    public get transactionsCount(): number {
        const channels = Object.values(this._channels);
        return (
            this.transactionsCountOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.transactionsCount;
            }, 0)
        );
    }

    public get securityTokenCount(): number {
        const channels = Object.values(this._channels);
        return (
            this.securityTokenCountOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.securityTokenCount;
            }, 0)
        );
    }

    public get activeChannelCount(): number {
        return Object.keys(this._channels).length;
    }

    private _dump_statistics() {
        this._server?.getConnections((_err: Error | null, count: number) => {
            debugLog(chalk.cyan("CONCURRENT CONNECTION = "), count);
        });
        debugLog(chalk.cyan("MAX CONNECTIONS = "), this._server?.maxConnections);
    }

    private _setup_server() {
        assert(!this._server);
        this._server = net.createServer({ pauseOnConnect: true }, this._on_client_connection.bind(this));

        // xx console.log(" Server with max connections ", self.maxConnections);
        this._server.maxConnections = this.maxConnections + 1; // plus one extra

        this._listen_callback = undefined;
        this._server
            .on("connection", (socket: Socket) => {
                // c8 ignore next
                if (doDebug) {
                    this._dump_statistics();
                    debugLog(`server connected  with : ${socket.remoteAddress}:${socket.remotePort}`);
                }
            })
            .on("close", () => {
                debugLog("server closed : all connections have ended");
            })
            .on("error", (err: Error) => {
                // this could be because the port is already in use
                debugLog(chalk.red.bold("server error: "), err.message);
            });
    }

    private _on_client_connection(socket: Socket) {
        // a client is attempting a connection on the socket
        socket.setNoDelay(true);

        debugLog("OPCUAServerEndPoint#_on_client_connection", this._started);
        if (!this._started) {
            debugLog(
                chalk.bgWhite.cyan(
                    "OPCUAServerEndPoint#_on_client_connection " +
                    "SERVER END POINT IS PROBABLY SHUTTING DOWN !!! - Connection is refused"
                )
            );
            socket.end();
            return;
        }
        const deny_connection = () => {
            console.log(
                chalk.bgWhite.cyan(
                    "OPCUAServerEndPoint#_on_client_connection " +
                    "The maximum number of connection has been reached - Connection is refused"
                )
            );
            const reason = `maxConnections reached (${this.maxConnections})`;
            const socketData = extractSocketData(socket, reason);
            this.emit("connectionRefused", socketData);

            socket.end();
            socket.destroy();
        };

        const establish_connection = () => {
            const nbConnections = Object.keys(this._channels).length;
            if (nbConnections >= this.maxConnections) {
                warningLog(
                    " nbConnections ",
                    nbConnections,
                    " self._server.maxConnections",
                    this._server?.maxConnections,
                    this.maxConnections
                );
                deny_connection();
                return;
            }

            debugLog("OPCUAServerEndPoint._on_client_connection successful => New Channel");

            const channel = new ServerSecureChannelLayer({
                defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
                // objectFactory: this.objectFactory,
                parent: this,
                timeout: this.timeout,
                adjustTransportLimits: this.transportSettings?.adjustTransportLimits
            });

            debugLog("channel Timeout = >", channel.timeout);

            socket.resume();

            this._preregisterChannel(channel);

            channel.init(socket, (err?: Error) => {
                this._un_pre_registerChannel(channel);
                debugLog(chalk.yellow.bold("Channel#init done"), err);
                if (err) {
                    const reason = `openSecureChannel has Failed ${err.message}`;
                    const socketData = extractSocketData(socket, reason);
                    const channelData = extractChannelData(channel);
                    this.emit("openSecureChannelFailure", socketData, channelData);

                    socket.end();
                    socket.destroy();
                } else {
                    debugLog("server receiving a client connection");
                    this._registerChannel(channel);
                }
            });

            channel.on("message", (message: Message) => {
                // forward
                this.emit("message", message, channel, this);
            });
        };

        // Each SecureChannel exists until it is explicitly closed or until the last token has expired and the overlap
        // period has elapsed. A Server application should limit the number of SecureChannels.
        // To protect against misbehaving Clients and denial of service attacks, the Server shall close the oldest
        // SecureChannel that has no Session assigned before reaching the maximum number of supported SecureChannels.
        this._prevent_DDOS_Attack(establish_connection, deny_connection);
    }
    private _preregisterChannel(channel: ServerSecureChannelLayer) {
        // _preregisterChannel is used to keep track of channel for which
        // that are in early stage of the hand shaking process.
        // e.g HEL/ACK and OpenSecureChannel may not have been received yet
        // as they will need to be interrupted when OPCUAServerEndPoint is closed
        assert(this._started, "OPCUAServerEndPoint must be started");

        assert(!Object.hasOwn(this._channels, channel.hashKey), " channel already preregistered!");

        this._channels[channel.hashKey] = channel;
        const onAbort = () => {
            debugLog("Channel received an abort event during the preregistration phase");
            this._un_pre_registerChannel(channel);
            channel.dispose();
        };
        preregisterAbortListeners.set(channel, onAbort);
        channel.on("abort", onAbort);
    }

    private _un_pre_registerChannel(channel: ServerSecureChannelLayer) {
        if (!this._channels[channel.hashKey]) {
            debugLog("Already un preregistered ?", channel.hashKey);
            return;
        }
        delete this._channels[channel.hashKey];
        const onAbort = preregisterAbortListeners.get(channel);
        if (onAbort) {
            channel.removeListener("abort", onAbort);
            preregisterAbortListeners.delete(channel);
        }
    }

    /**
     * @private
     */
    private _registerChannel(channel: ServerSecureChannelLayer) {
        if (this._started) {
            debugLog(chalk.red("_registerChannel = "), "channel.hashKey = ", channel.hashKey);

            assert(!this._channels[channel.hashKey]);
            this._channels[channel.hashKey] = channel;

            /**
             * @event newChannel — fired after transport init (HEL/ACK).
             * Note: securityPolicy/securityMode are NOT yet established.
             * @param channel
             */
            this.emit("newChannel", channel);

            channel.once("open", () => {
                /**
                 * @event channelSecured — fired after OpenSecureChannel
                 * handshake succeeds. securityPolicy, securityMode, and
                 * clientCertificate are available at this point.
                 * @param channel
                 */
                this.emit("channelSecured", channel);
            });

            channel.on("abort", () => {
                this._unregisterChannel(channel);
            });
        } else {
            debugLog("OPCUAServerEndPoint#_registerChannel called when end point is shutdown !");
            debugLog("  -> channel will be forcefully terminated");
            channel.close(() => {
                channel.dispose();
            });
        }
    }

    /**
     */
    private _unregisterChannel(channel: ServerSecureChannelLayer): void {
        debugLog("_un-registerChannel channel.hashKey", channel.hashKey);
        if (!Object.hasOwn(this._channels, channel.hashKey)) {
            return;
        }

        assert(Object.hasOwn(this._channels, channel.hashKey), "channel is not registered");

        /**
         * @event closeChannel
         * @param channel
         */
        this.emit("closeChannel", channel);

        // keep trace of statistics data from old channel for our own accumulated stats.
        this.bytesWrittenInOldChannels += channel.bytesWritten;
        this.bytesReadInOldChannels += channel.bytesRead;
        this.transactionsCountOldChannels += channel.transactionsCount;
        delete this._channels[channel.hashKey];

        // c8 ignore next
        if (doDebug) {
            this._dump_statistics();
            debugLog("un-registering channel  - Count = ", this.currentChannelCount);
        }

        /// channel.dispose();
    }

    private _end_listen(err?: Error) {
        if (!this._listen_callback) return;
        this._listen_callback(err);
        this._listen_callback = undefined;
    }

    /**
     *  shutdown_channel
     * @param channel
     * @param inner_callback
     */
    private shutdown_channel(channel: ServerSecureChannelLayer, inner_callback: (err?: Error) => void) {
        assert(typeof inner_callback === "function");
        channel.once("close", () => {
            // xx console.log(" ON CLOSED !!!!");
        });

        channel.close(() => {
            this._unregisterChannel(channel);
            setImmediate(inner_callback);
        });
    }

    /**
     * @private
     */
    private _prevent_DDOS_Attack(establish_connection: () => void, deny_connection: () => void) {
        const nbConnections = this.activeChannelCount;

        if (nbConnections >= this.maxConnections) {
            // c8 ignore next
            errorLog(chalk.bgRed.white(`PREVENTING DDOS ATTACK => maxConnection =${this.maxConnections}`));

            const unused_channels: ServerSecureChannelLayer[] = this.getChannels().filter((channel1: ServerSecureChannelLayer) => {
                return !channel1.hasSession;
            });
            if (unused_channels.length === 0) {
                doDebug &&
                    console.log(
                        this.getChannels()
                            .map(({ status, isOpened, hasSession }) => `${status} ${isOpened} ${hasSession}\n`)
                            .join(" ")
                    );
                // all channels are in used , we cannot get any
                errorLog(`All channels are in used ! we cannot cancel any ${this.getChannels().length}`);
                // c8 ignore next
                if (doDebug) {
                    console.log("  - all channels are used !!!!");
                    false && dumpChannelInfo(this.getChannels());
                }
                setTimeout(deny_connection, 1000);
                return;
            }
            // c8 ignore next
            if (doDebug) {
                console.log(
                    "   - Unused channels that can be clobbered",
                    unused_channels.map((channel1: ServerSecureChannelLayer) => channel1.hashKey).join(" ")
                );
            }
            const channel = unused_channels[0];
            errorLog(`${unused_channels.length} : Forcefully closing oldest channel that have no session: ${channel.hashKey}`);
            channel.close(() => {
                // c8 ignore next
                if (doDebug) {
                    console.log("   _ Unused channel has been closed ", channel.hashKey);
                }
                this._unregisterChannel(channel);
                establish_connection();
            });
        } else {
            setImmediate(establish_connection);
        }
    }
}

interface MakeEndpointDescriptionOptions {
    /**
     * @default  default hostname (default value will be full qualified domain name)
     */
    hostname: string;

    /**
     *
     */
    securityMode: MessageSecurityMode;
    /**
     *
     */
    securityPolicy: SecurityPolicy;

    securityLevel?: number;

    server: ApplicationDescription;
    /*
        {
            applicationUri: string;
            applicationName: LocalizedTextOptions;
            applicationType: ApplicationType;
            gatewayServerUri: string;
            discoveryProfileUri: string;
            discoveryUrls: string[];
        };
     */
    resourcePath?: string;

    // allow un-encrypted password in userNameIdentity
    allowUnsecurePassword?: boolean; // default false

    /**
     * onlyCertificateLessConnection
     */
    onlyCertificateLessConnection?: boolean;

    restricted: boolean;

    collection: { [key: string]: number };

    securityPolicies: SecurityPolicy[];

    userTokenTypes: UserTokenType[];
    /**
     * Override the port used in the dynamic endpointUrl getter.
     * When set, the endpoint URL advertises this port instead of
     * the parent's listen port.
     */
    advertisedPort?: number;
    /**
     *
     * default value: false;
     *
     * note: setting noUserIdentityTokens=true is useful for pure local discovery servers
     */
    noUserIdentityTokens?: boolean;
}

export interface EndpointDescriptionEx extends EndpointDescription {
    _parent: OPCUAServerEndPoint;
    restricted: boolean;
}

function estimateSecurityLevel(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): number {
    if (securityMode === MessageSecurityMode.None) {
        return 1;
    }
    let offset = 100;
    if (securityMode === MessageSecurityMode.SignAndEncrypt) {
        offset = 200;
    }
    switch (securityPolicy) {
        case SecurityPolicy.Basic128:
        case SecurityPolicy.Basic128Rsa15:
        case SecurityPolicy.Basic192:
            return 2; // deprecated => low
        case SecurityPolicy.Basic192Rsa15:
            return 3; // deprecated => low
        case SecurityPolicy.Basic256:
            return 4; // deprecated => low
        case SecurityPolicy.Basic256Rsa15:
            return 4 + offset;
        case SecurityPolicy.Aes128_Sha256_RsaOaep:
            return 5 + offset;
        case SecurityPolicy.Basic256Sha256:
            return 6 + offset;
        case SecurityPolicy.Aes256_Sha256_RsaPss:
            return 7 + offset;

        default:
            return 1;
    }
}
/**
 * @private
 */
function _makeEndpointDescription(options: MakeEndpointDescriptionOptions, parent: OPCUAServerEndPoint): EndpointDescriptionEx {
    const u = (n: string) => getUniqueName(n, options.collection);
    options.securityLevel =
        options.securityLevel === undefined
            ? estimateSecurityLevel(options.securityMode, options.securityPolicy)
            : options.securityLevel;
    assert(Number.isFinite(options.securityLevel), "expecting a valid securityLevel");

    const securityPolicyUri = toURI(options.securityPolicy);

    const userIdentityTokens: UserTokenPolicyOptions[] = [];

    const registerIdentity2 = (tokenType: UserTokenType, securityPolicy: SecurityPolicy, name: string) => {
        return registerIdentity({
            policyId: u(name),
            tokenType,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: securityPolicy
        });
    };
    const registerIdentity = (r: UserTokenPolicyOptions) => {
        const tokenType = r.tokenType === undefined ? UserTokenType.Invalid : r.tokenType;
        const securityPolicy = (r.securityPolicyUri || "") as SecurityPolicy;
        if (!securityPolicy && options.userTokenTypes.indexOf(tokenType) >= 0) {
            userIdentityTokens.push(r);
            return;
        }
        if (options.securityPolicies.indexOf(securityPolicy) >= 0 && options.userTokenTypes.indexOf(tokenType) >= 0) {
            userIdentityTokens.push(r);
        }
    };

    if (!options.noUserIdentityTokens) {
        if (options.securityPolicy === SecurityPolicy.None) {
            if (options.allowUnsecurePassword) {
                registerIdentity({
                    policyId: u("username_unsecure"),
                    tokenType: UserTokenType.UserName,

                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });
            }

            const onlyCertificateLessConnection =
                options.onlyCertificateLessConnection === undefined ? false : options.onlyCertificateLessConnection;

            if (!onlyCertificateLessConnection) {
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic256, "username_basic256");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic128Rsa15, "username_basic128Rsa15");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic256Sha256, "username_basic256Sha256");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Aes128_Sha256_RsaOaep, "username_aes128Sha256RsaOaep");

                // X509
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic256, "certificate_basic256");
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic128Rsa15, "certificate_basic128Rsa15");
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic256Sha256, "certificate_basic256Sha256");
                registerIdentity2(
                    UserTokenType.Certificate,
                    SecurityPolicy.Aes128_Sha256_RsaOaep,
                    "certificate_aes128Sha256RsaOaep"
                );
            }
        } else {
            // note:
            //  when channel session security is not "None",
            //  userIdentityTokens can be left to null.
            //  in this case this mean that secure policy will be the same as connection security policy
            // c8 ignore next
            if (process.env.NODEOPCUA_SERVER_EMULATE_SIEMENS) {
                // However, for some reason SIEMENS plc requires that password get encrypted even though
                // the secure channel is also encrypted ....
                // you can set the NODEOPCUA_SERVER_EMULATE_SIEMENS env variable to simulate this behavior
                const registerIdentity3 = (tokenType: UserTokenType, securityPolicy: SecurityPolicy, name: string) => {
                    const identity = {
                        policyId: u(name),
                        tokenType,
                        issuedTokenType: null,
                        issuerEndpointUrl: null,
                        securityPolicyUri: securityPolicy
                    };
                    userIdentityTokens.push(identity);
                };
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic256, "username_basic256");
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic128Rsa15, "username_basic128Rsa15");
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic256Sha256, "username_basic256Sha256");
            } else {
                registerIdentity({
                    policyId: u("usernamePassword"),
                    tokenType: UserTokenType.UserName,
                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });

                registerIdentity({
                    policyId: u("certificateX509"),
                    tokenType: UserTokenType.Certificate,

                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });
            }
        }

        registerIdentity({
            policyId: u("anonymous"),
            tokenType: UserTokenType.Anonymous,

            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }
    // return the endpoint object
    const endpoint = new EndpointDescription({
        endpointUrl: "<to be evaluated at run time>", // options.endpointUrl,

        server: undefined, // options.server,
        // serverCertificate is set as a dynamic getter below
        serverCertificate: undefined,

        securityMode: options.securityMode,
        securityPolicyUri,
        userIdentityTokens,

        securityLevel: options.securityLevel,
        transportProfileUri: UATCP_UASC_UABINARY
    }) as EndpointDescriptionEx;
    endpoint._parent = parent;

    // serverCertificate — always dynamic.
    // Delegates to the parent endpoint's combined DER cache
    // which in turn reads from the current ICertificateChainProvider.
    // This ensures GetEndpoints always returns the current chain,
    // whether the provider is static or disk-based.
    Object.defineProperty(endpoint, "serverCertificate", {
        get: () => parent.getCombinedCertificate(),
        configurable: true
    });

    // endpointUrl is dynamic as port number may be adjusted
    // when the tcp socket start listening
    Object.defineProperty(endpoint, "endpointUrl", {
        get: () => {
            const port = options.advertisedPort ?? endpoint._parent.port;
            const resourcePath = options.resourcePath || "";
            const hostname = options.hostname;
            const endpointUrl = `opc.tcp://${hostname}:${port}${resourcePath}`;
            return resolveFullyQualifiedDomainName(endpointUrl);
        },
        configurable: true
    });

    endpoint.server = options.server;

    endpoint.restricted = options.restricted;

    return endpoint;
}

/**
 * return true if the end point matches security mode and policy
 * @param endpoint
 * @param securityMode
 * @param securityPolicy
 * @internal
 *
 */
function matching_endpoint(
    securityMode: MessageSecurityMode,
    securityPolicy: SecurityPolicy,
    endpointUrl: string | null,
    endpoint: EndpointDescription
): boolean {
    assert(endpoint instanceof EndpointDescription);
    const endpoint_securityPolicy = fromURI(endpoint.securityPolicyUri);
    if (endpointUrl && endpoint.endpointUrl !== endpointUrl) {
        return false;
    }
    return endpoint.securityMode === securityMode && endpoint_securityPolicy === securityPolicy;
}

const defaultSecurityModes = [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt];

const defaultSecurityPolicies = [
    // now deprecated  Basic128Rs15 shall be disabled by default
    // see https://profiles.opcfoundation.org/profile/1532
    // SecurityPolicy.Basic128Rsa15,

    // now deprecated Basic256 shall be disabled by default
    // see https://profiles.opcfoundation.org/profile/2062
    // SecurityPolicy.Basic256,

    // xx UNUSED!!  SecurityPolicy.Basic192Rsa15,
    // xx UNUSED!!  SecurityPolicy.Basic256Rsa15,

    SecurityPolicy.Basic256Sha256,
    SecurityPolicy.Aes128_Sha256_RsaOaep,
    SecurityPolicy.Aes256_Sha256_RsaPss
];

const defaultUserTokenTypes = [
    UserTokenType.Anonymous,
    UserTokenType.UserName,
    UserTokenType.Certificate
    // NOT USED YET : UserTokenType.IssuedToken
];
