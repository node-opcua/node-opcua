/**
 * @module node-opcua-server
 */
import { type OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ICertificateStore, type IOPCUASecureObjectOptions, OPCUASecureObject } from "node-opcua-common";
import type { Message, Request, Response, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { ApplicationDescription, ApplicationType } from "node-opcua-service-endpoints";
import { type OpenSecureChannelRequest, ServiceFault } from "node-opcua-service-secure-channel";
import { type StatusCode } from "node-opcua-status-code";
import { type ApplicationDescriptionOptions, EndpointDescription } from "node-opcua-types";
import type { IChannelData } from "./i_channel_data.js";
import type { ISocketData } from "./i_socket_data.js";
import type { OPCUAServerEndPoint } from "./server_end_point.js";
/**
 * Rewrite the DiscoveryUrls of an ApplicationDescription so that they are reachable
 * through the network address the Client actually used.
 *
 * OPC 10000-4 v1.05.07 5.5.2.1: "A Server may have multiple HostNames. For this reason, the
 * Client shall pass the URL it used to connect to the Endpoint to this Service. The
 * implementation of this Service shall use this information to return responses that are
 * accessible to the Client via the provided URL." and 5.5.2.2 (endpointUrl parameter):
 * "The Server uses this information [...] to determine what URLs to return in the response.
 *  The Server should return a suitable default URL if it does not recognize the HostName in
 *  the URL."
 *
 * Only the host part is substituted, and only on the DiscoveryUrls that the server serves on
 * the very port the client used: a requested URL on a port this server does not serve, an
 * unparsable URL, or an empty one leaves the DiscoveryUrls untouched (the "suitable default").
 *
 * @internal
 */
export declare function adaptDiscoveryUrls(discoveryUrls: (string | null)[] | null, requestedEndpointUrl: string | null): string[];
/**
 * Check whether the host name a Client used to reach this server is covered by the
 * server certificate, and return it when it is not.
 *
 * OPC 10000-4 v1.05.07 5.6.2.1 (OpenSecureChannel): "Servers shall add all possible
 * HostNames like MyHost and MyHost.mycompany.com into the Server Certificate. This
 * includes IP addresses of the host or the HostName exposed by a NAT router used to
 * connect to the Server." and "a Client shall verify the HostName specified in the
 * Server Certificate is the same as the HostName contained in the endpointUrl."
 *
 * Returns null (nothing to report) when: the URL is empty or cannot be parsed, the host
 * is a loopback address (localhost, 127.0.0.0/8, ::1, [::1]), the host is an IPv6
 * literal (IPv6 SAN entries are not matched here, mirroring checkCertificateSAN()), the
 * certificate cannot be explored, or the host is already covered by a dNSName (matched
 * case-insensitively) or, for an IPv4 literal, an iPAddress SAN entry.
 *
 * Otherwise returns the host exactly as it appears in the URL, lower-cased.
 *
 * @internal
 */
export declare function findEndpointHostMissingFromCertificate(endpointUrl: string | null | undefined, certificate: Buffer): string | null;
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
    serverCertificateManager?: OPCUACertificateManager | ICertificateStore;
}
export interface OPCUABaseServerEvents {
    request: [request: Request, channel: ServerSecureChannelLayer];
    response: [response: Response, channel: ServerSecureChannelLayer];
    newChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    channelSecured: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    closeChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    connectionRefused: [socketData: ISocketData, endpoint: OPCUAServerEndPoint];
    openSecureChannelFailure: [socketData: ISocketData, channelData: IChannelData, endpoint: OPCUAServerEndPoint];
    openSecureChannelRequest: [request: OpenSecureChannelRequest, channel: ServerSecureChannelLayer];
    openSecureChannelResponse: [response: Response, channel: ServerSecureChannelLayer];
}
export declare class OPCUABaseServer<T extends OPCUABaseServerEvents = any> extends OPCUASecureObject<T> {
    static makeServiceFault: typeof makeServiceFault;
    /**
     * The type of server
     */
    get serverType(): ApplicationType;
    serverInfo: ApplicationDescription;
    endpoints: OPCUAServerEndPoint[];
    readonly serverCertificateManager: ICertificateStore;
    capabilitiesForMDNS: string[];
    protected _preInitTask: (() => Promise<void>)[];
    /**
     * Per-host "is this host covered by the certificate" verdicts backing
     * _warnIfEndpointHostNotInCertificate(), keyed by the lower-cased host. Covers
     * both outcomes so a correctly covered host is never rechecked either. Left
     * undefined until first used: tests build a server with
     * Object.create(OPCUABaseServer.prototype), which skips the constructor.
     */
    protected _endpointHostCertificateCache?: Map<string, boolean>;
    /**
     * The certificate (compared by reference) that _endpointHostCertificateCache was
     * computed against. Every certificate provider in this codebase hands back the
     * same Buffer instance from getCertificate() until it is invalidated, so a
     * reference change reliably signals a new certificate and resets the cache.
     */
    protected _endpointHostCertificateCacheCertificate?: Buffer;
    protected options: OPCUABaseServerOptions;
    constructor(options?: OPCUABaseServerOptions);
    /**
     * Return additional DNS hostnames to include in the self-signed
     * certificate's SubjectAlternativeName (SAN).
     *
     * The base implementation returns an empty array. Subclasses
     * (e.g. `OPCUAServer`) override this to include hostnames from
     * `alternateHostname` and `advertisedEndpoints`.
     *
     * Public so packages outside `node-opcua-server` (e.g.
     * `node-opcua-server-configuration`'s CreateSigningRequest handler) can
     * reuse the same configured-hostnames list for a CSR's SAN, not only
     * for the initial self-signed certificate.
     *
     * @internal
     */
    getConfiguredHostnames(): string[];
    /**
     * Return additional IP addresses to include in the self-signed
     * certificate's SubjectAlternativeName (SAN) iPAddress entries.
     *
     * The base implementation returns an empty array. Subclasses
     * (e.g. `OPCUAServer`) override this to include IP literals
     * found in `alternateHostname` and `advertisedEndpoints`.
     *
     * These IPs are considered **explicitly configured** by the
     * user and are therefore checked by `checkCertificateSAN()`.
     * In contrast, auto-detected IPs from `getIpAddresses()` are
     * included in the certificate at creation time but are NOT
     * checked later — see `checkCertificateSAN()` for rationale.
     *
     * Public for the same reason as {@link getConfiguredHostnames}.
     *
     * @internal
     */
    getConfiguredIPs(): string[];
    createDefaultCertificate(): Promise<void>;
    initializeCM(): Promise<void>;
    /**
     * Check that the server's certificate PEM contains the full
     * chain (leaf + issuer CAs).  If the certificate is CA-signed
     * but the PEM only contains the leaf, a prominent warning is
     * logged so the operator can detect the mismatch easily.
     *
     * This method intentionally does NOT attempt to auto-heal the
     * certificate file — the provisioning layer (GDS UpdateCertificate,
     * CLI tools, etc.) is responsible for writing the full chain.
     * Use {@link CertificateManager.completeCertificateChain} in
     * provisioning code to reconstruct a partial chain.
     *
     * @internal
     */
    private _checkOwnCertificateChainCompleteness;
    /**
     * Compare the current certificate's SAN entries against all
     * explicitly configured hostnames and IPs, and return any
     * that are missing.
     *
     * Returns an empty array when the certificate covers every
     * configured hostname and IP.
     *
     * **Important — ephemeral IP mitigation:**
     * Auto-detected IPs (from `getIpAddresses()`) are deliberately
     * NOT included in this check. Network interfaces are transient
     * — WiFi IPs change on reconnect, tethering IPs appear/disappear,
     * VPN adapters come and go. Including them would cause the
     * `[NODE-OPCUA-W26]` warning to fire on every server restart
     * whenever the network state differs from when the certificate
     * was originally created.
     *
     * Only **explicitly configured** values are checked:
     * - Hostnames: FQDN, os.hostname(), `alternateHostname` (non-IP),
     *   hostnames from `advertisedEndpoints` URLs
     * - IPs: IP literals from `alternateHostname`, IP literals
     *   from `advertisedEndpoints` URLs
     *
     * The certificate itself still includes auto-detected IPs at
     * creation time — this is fine because it captures the network
     * state at that moment. But the *mismatch warning* only fires
     * for things the user explicitly asked for.
     */
    checkCertificateSAN(): string[];
    /**
     * Delete the existing self-signed certificate and create a new
     * one that includes all currently configured hostnames.
     *
     * @throws if the current certificate was NOT self-signed
     *         (i.e. issued by a CA or GDS)
     */
    regenerateSelfSignedCertificate(): Promise<void>;
    private _checkCertificateSanMismatch;
    /**
     * Thin wrapper around findEndpointHostMissingFromCertificate() (the exploreCertificate()
     * ASN.1 parse), extracted so tests can spy on how many times the expensive check
     * actually runs when _warnIfEndpointHostNotInCertificate() caches its verdicts.
     */
    protected _findEndpointHostMissingFromCertificate(endpointUrl: string, certificate: Buffer): string | null;
    /**
     * Warn once per host when a Client reaches this server through a host name that
     * the server certificate does not cover (see findEndpointHostMissingFromCertificate()
     * for the spec reference). Called from the GetEndpoints and CreateSession request
     * paths, both reachable before any Session exists.
     *
     * OPC 10000-4 v1.05.07 5.5.4.1 (GetEndpoints): "the Server should minimize the
     * amount of processing required to send the response for this Service." GetEndpoints
     * is unauthenticated, so a host, once checked against the current certificate, is
     * never rechecked, whether it turned out covered or missing, and the number of
     * distinct hosts remembered (MAX_CACHED_HOSTS) and warned about (MAX_WARNED_HOSTS)
     * are both capped so an attacker sending arbitrarily many host names cannot grow
     * the cache or the log without bound. The cache is reset when the certificate
     * itself changes (e.g. after regenerateSelfSignedCertificate()), so a still-missing
     * host is warned about once more.
     *
     * Never throws: a failure here must not change the response sent to the Client.
     */
    protected _warnIfEndpointHostNotInCertificate(endpointUrl: string | null | undefined): void;
    /**
     * start all registered endPoint, in parallel, and call done when all endPoints are listening.
     */
    start(): Promise<void>;
    start(done: () => void): void;
    protected performPreInitialization(): Promise<void>;
    protected startAsync(): Promise<void>;
    /**
     * shutdown all server endPoints
     */
    shutdown(done: (err?: Error | null) => void): void;
    shutdownChannels(): Promise<void>;
    shutdownChannels(callback: (err?: Error | null) => void): void;
    /**
     * @private
     */
    on_request(message: Message, channel: ServerSecureChannelLayer): void;
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
    findMatchingEndpoints(endpointUrl?: string | null): EndpointDescription[];
    /**
     * get one of the possible endpointUrl
     */
    getEndpointUrl(): string;
    getDiscoveryUrls(): string[];
    getServers(_channel: ServerSecureChannelLayer): ApplicationDescription[];
    /**
     * set all the end point into a state where they do not accept further connections
     *
     * note:
     *     this method is useful for testing purpose
     *
     */
    suspendEndPoints(): Promise<void>;
    suspendEndPoints(callback: (err?: Error | null) => void): void;
    /**
     * set all the end point into a state where they do accept connections
     * note:
     *    this method is useful for testing purpose
     */
    resumeEndPoints(): Promise<void>;
    resumeEndPoints(callback: (err?: Error | null) => void): void;
    protected prepare(_message: Message, _channel: ServerSecureChannelLayer): void;
    /**
     * @private
     */
    protected _on_GetEndpointsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     * @private
     */
    protected _on_FindServersRequest(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     * returns a array of currently active channels
     */
    protected getChannels(): ServerSecureChannelLayer[];
}
/**
 * construct a service Fault response
 */
declare function makeServiceFault(statusCode: StatusCode, messages: string[]): ServiceFault;
export {};
//# sourceMappingURL=base_server.d.ts.map