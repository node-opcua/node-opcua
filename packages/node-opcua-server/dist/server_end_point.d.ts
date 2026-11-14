/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type Socket } from "node:net";
import { type ICertificateChainProvider, type ICertificateStore } from "node-opcua-common";
import { type Certificate, type IKeyOperations } from "node-opcua-crypto/web";
import { MessageSecurityMode, SecurityPolicy, ServerSecureChannelLayer, type ServerSecureChannelParent } from "node-opcua-secure-channel";
import { ApplicationDescription, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import type { StatusCode } from "node-opcua-status-code";
import { type IHelloAckLimits } from "node-opcua-transport";
import type { IChannelData } from "./i_channel_data.js";
import type { ISocketData } from "./i_socket_data.js";
/**
 * @internal node-opcua plumbing: may change in a minor release. Endpoints
 * are created and configured through OPCUAServer options.
 */
export interface OPCUAServerEndPointOptions {
    /**
     * the tcp port
     */
    port: number;
    /**
     * the tcp host
     */
    host?: string;
    /** share the port with other listeners (SO_REUSEPORT): see OPCUAServerEndpointOptions.reusePort */
    reusePort?: boolean;
    /**
     * The certificate chain and key of this endpoint, as a provider — the
     * endpoint never holds raw private-key material. For an in-memory
     * chain/key pair use a {@link StaticCertificateChainProvider}; the
     * server passes its own resolved/opaque/disk provider.
     */
    certificateKeyPairProvider: ICertificateChainProvider;
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
 * Per-URL security restrictions for advertised endpoints.
 *
 * All advertised URLs share the listener's socket: an entry can only make
 * its URL stricter than the main endpoint, and it only binds clients that
 * present that URL (a client presenting the main URL gets the main settings).
 * See documentation/advertised_endpoints.md, "Security Model".
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
    /** Restrict security modes (default: inherit from main endpoint); modes the main endpoint lacks are ignored */
    securityModes?: MessageSecurityMode[];
    /** Restrict security policies (default: inherit from main endpoint); policies the main endpoint lacks are ignored */
    securityPolicies?: SecurityPolicy[];
    /** `false` removes anonymous access for this URL (default: inherit from main endpoint); `true` cannot add it */
    allowAnonymous?: boolean;
    /**
     * Restrict user token types (default: inherit from main endpoint).
     *
     * This list can only restrict the main endpoint list: token types that
     * the main endpoint does not allow are ignored (with a warning).
     *
     * note: all URLs of a listener share the same socket and the server
     * cannot verify which URL a client really used, so this restriction
     * guides well-behaved clients but is not an authentication boundary:
     * a client that presents the main URL gets the main list. To enforce a
     * different list, give it its own listener (`endpoints: [{ port, userTokenTypes }]`).
     */
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
export declare function normalizeAdvertisedEndpoints(raw?: AdvertisedEndpoint | AdvertisedEndpoint[]): AdvertisedEndpointConfig[];
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
 * Parse an `opc.tcp://hostname:port/path` URL and extract hostname, port and resource path.
 * A path made of a single `/` is treated as no path.
 * @internal
 */
export declare function parseOpcTcpUrl(url: string): {
    hostname: string;
    port: number;
    resourcePath: string;
};
/**
 * OPCUAServerEndPoint a Server EndPoint.
 * A sever end point is listening to one port
 * note:
 *   see OPCUA Release 1.03 part 4 page 108 7.1 ApplicationDescription
 */
export declare class OPCUAServerEndPoint extends EventEmitter implements ServerSecureChannelParent {
    #private;
    /** @internal see ServerSecureChannelParent.leanRequestHandler: set by the server that has one */
    leanRequestHandler?: ServerSecureChannelParent["leanRequestHandler"];
    /**
     * the tcp port
     */
    port: number;
    host: string | undefined;
    readonly reusePort: boolean;
    certificateManager: ICertificateStore;
    defaultSecureTokenLifetime: number;
    maxConnections: number;
    timeout: number;
    bytesWrittenInOldChannels: number;
    bytesReadInOldChannels: number;
    transactionsCountOldChannels: number;
    securityTokenCountOldChannels: number;
    serverInfo: ApplicationDescription;
    objectFactory: unknown;
    _on_new_channel?: (channel: ServerSecureChannelLayer) => void;
    _on_channel_secured?: (channel: ServerSecureChannelLayer) => void;
    _on_close_channel?: (channel: ServerSecureChannelLayer) => void;
    _on_connectionRefused?: (socketData: ISocketData) => void;
    _on_openSecureChannelFailure?: (socketData: ISocketData, channelData: IChannelData) => void;
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
    onAdjustCertificateStatus?: (statusCode: StatusCode, certificate: Certificate) => StatusCode | Promise<StatusCode>;
    /**
     * Implements `ServerSecureChannelParent.adjustCertificateStatus`.
     * Delegates to the `onAdjustCertificateStatus` callback if set.
     */
    adjustCertificateStatus(statusCode: StatusCode, certificate: Certificate): StatusCode | Promise<StatusCode>;
    private _channels;
    private _server?;
    private _endpoints;
    private _listen_callback?;
    private _started;
    private _counter;
    private _policy_deduplicator;
    private transportSettings?;
    constructor(options: OPCUAServerEndPointOptions);
    dispose(): void;
    toString(): string;
    toJSON(): Record<string, unknown>;
    getChannels(): ServerSecureChannelLayer[];
    /**
     * Returns the X509 DER form of the server certificate
     */
    getCertificate(): Certificate;
    /**
     * Returns the X509 DER form of the server certificate
     */
    getCertificateChain(): Certificate[];
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
    setCertificateProvider(provider: ICertificateChainProvider): void;
    /**
     * Return the current certificate chain provider.
     * Useful for calling `invalidate()` after certificate rotation.
     */
    getCertificateProvider(): ICertificateChainProvider;
    /**
     * Invalidate the combined DER cache.
     *
     * Called after the underlying provider's chain changes
     * (e.g. after `provider.invalidate()` or `provider.update()`).
     * The next `EndpointDescription.serverCertificate` access
     * will recompute the combined DER from the provider.
     */
    invalidateCombinedDerCache(): void;
    /**
     * Convenience method: invalidate both the provider's cache
     * (so it re-reads from disk) and the combined DER cache
     * (so endpoint descriptions recompute `serverCertificate`).
     *
     * Prefer this over calling `getCertificateProvider().invalidate()`
     * and `invalidateCombinedDerCache()` separately.
     */
    invalidateCertificates(): void;
    /**
     * Get the combined DER certificate (all certs concatenated)
     * for use in EndpointDescription.serverCertificate.
     * Cached internally; invalidated by provider changes.
     * @internal
     */
    getCombinedCertificate(): Certificate | undefined;
    /**
     * The endpoint's key as an opaque sign/decrypt object — the endpoint's
     * ONLY key access: raw private-key material never enters the endpoint.
     */
    getKeyOperations(): IKeyOperations;
    /**
     * The number of active channel on this end point.
     */
    get currentChannelCount(): number;
    /**
     */
    getEndpointDescription(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy, endpointUrl: string | null): EndpointDescription | null;
    addEndpointDescription(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy, options: EndpointDescriptionParams): void;
    addRestrictedEndpointDescription(options: EndpointDescriptionParams): void;
    addStandardEndpointDescriptions(options?: AddStandardEndpointDescriptionsParam): void;
    /**
     * returns the list of end point descriptions.
     */
    endpointDescriptions(): EndpointDescription[];
    /**
     */
    listen(callback: (err?: Error) => void): void;
    killClientSockets(callback: (err?: Error) => void): void;
    /**
     * Stops the server accepting new connections and returns a promise that
     * settles once node has emitted the 'close' event - the point where the
     * listening handle is genuinely released and the port can be bound again.
     * close() is asynchronous and finishes only once every accepted
     * connection has ended, so callers decide what to do with the still
     * connected sockets before (or while) awaiting the returned promise.
     */
    private _initiateListenerRelease;
    suspendConnection(callback: (err?: Error) => void): void;
    restoreConnection(callback: (err?: Error) => void): void;
    abruptlyInterruptChannels(): void;
    /**
     */
    shutdown(callback: (err?: Error) => void): void;
    /**
     */
    start(callback: (err?: Error) => void): void;
    get bytesWritten(): number;
    get bytesRead(): number;
    get transactionsCount(): number;
    get securityTokenCount(): number;
    get activeChannelCount(): number;
    private _dump_statistics;
    private _setup_server;
    private _on_client_connection;
    /**
     * Initiate a REVERSE connection (OPC UA Part 6 §7.1.3).
     *
     * The server dials an OUTBOUND socket to the Client's reverse-connect listener
     * (`clientEndpointUrl`), sends a ReverseHello ("RHE") carrying `serverUri`/`endpointUrl`,
     * and then feeds that socket through the very same SecureChannel bookkeeping used for
     * inbound connections (`_preregisterChannel` / `_registerChannel` / `newChannel`).
     *
     * @param clientEndpointUrl the Client's reverse listener URL to dial, e.g. `opc.tcp://client-host:8888`
     * @param options.serverUri    the server ApplicationUri to advertise in the ReverseHello
     * @param options.endpointUrl  the SecureChannel EndpointUrl the Client should use
     * @param options.connectionTimeout optional per-connection HEL timeout (ms)
     * @param callback called with the established channel, or an error (so the caller may retry)
     * @returns the outbound socket (so the caller can abort a pending dial), or undefined if not started
     */
    createReverseConnection(clientEndpointUrl: string, options: {
        serverUri: string;
        endpointUrl: string;
        connectionTimeout?: number;
    }, callback: (err: Error | null, channel?: ServerSecureChannelLayer) => void): Socket | undefined;
    private _preregisterChannel;
    private _un_pre_registerChannel;
    /**
     * @private
     */
    private _registerChannel;
    /**
     */
    private _unregisterChannel;
    private _end_listen;
    /**
     *  shutdown_channel
     * @param channel
     * @param inner_callback
     */
    private shutdown_channel;
    /**
     * @private
     */
    private _prevent_DDOS_Attack;
}
export interface EndpointDescriptionEx extends EndpointDescription {
    _parent: OPCUAServerEndPoint;
    restricted: boolean;
}
//# sourceMappingURL=server_end_point.d.ts.map