/**
 * @module node-opcua-server
 */
import { type IRolePolicyOverride, type IRoleResolver, type ISessionContext, type NodeSetLoaderOptions, type NodesetSource, type PseudoVariant, type PseudoVariantBoolean, type PseudoVariantByteString, type PseudoVariantDateTime, type PseudoVariantDuration, type PseudoVariantExtensionObject, type PseudoVariantExtensionObjectArray, type PseudoVariantLocalizedText, type PseudoVariantNodeId, type PseudoVariantString, type PseudoVariantStringPredefined, type RaiseEventData, type RoleIdLike, type UAEventType, type UnresolvedPermissionPolicy } from "node-opcua-address-space";
import type { MethodResult } from "node-opcua-address-space-base";
import type { StoreAddressSpaceOptions } from "node-opcua-address-space-store";
import { type OPCUACertificateManager } from "node-opcua-certificate-manager";
import { ServerState } from "node-opcua-common";
import { type Certificate, type Nonce } from "node-opcua-crypto/web";
import { DiagnosticInfo } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { type Message, MessageSecurityMode, type Request, type Response, SecurityPolicy, type ServerSecureChannelLayer, type SignatureData } from "node-opcua-secure-channel";
import { BrowseNextResponse, BrowseResponse } from "node-opcua-service-browse";
import { CallResponse } from "node-opcua-service-call";
import { UserTokenType } from "node-opcua-service-endpoints";
import { HistoryReadResponse } from "node-opcua-service-history";
import { ReadResponse } from "node-opcua-service-read";
import { RegisterNodesResponse, UnregisterNodesResponse } from "node-opcua-service-register-node";
import type { OpenSecureChannelRequest } from "node-opcua-service-secure-channel";
import { UserNameIdentityToken, X509IdentityToken } from "node-opcua-service-session";
import { CreateMonitoredItemsResponse, CreateSubscriptionResponse, DeleteSubscriptionsResponse, ModifyMonitoredItemsResponse, ModifySubscriptionResponse, RepublishResponse, SetPublishingModeResponse, SetTriggeringResponse, TransferSubscriptionsResponse } from "node-opcua-service-subscription";
import { TranslateBrowsePathsToNodeIdsResponse } from "node-opcua-service-translate-browse-path";
import { WriteResponse } from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { type ApplicationDescriptionOptions, type BuildInfo, EndpointDescription, type UserIdentityToken, type UserTokenPolicy } from "node-opcua-types";
import { type Variant } from "node-opcua-variant";
import { OPCUABaseServer, type OPCUABaseServerOptions } from "./base_server.js";
import type { IChannelData } from "./i_channel_data.js";
import type { IRegisterServerManager } from "./i_register_server_manager.js";
import type { ISocketData } from "./i_socket_data.js";
import type { INodeFinder } from "./monitorable_node.js";
import { MonitoredItem } from "./monitored_item.js";
import { type ReverseConnectOptions } from "./reverse_connect_manager.js";
import type { ServerCapabilitiesOptions } from "./server_capabilities.js";
import { type AdvertisedEndpoint, type IServerTransportSettings, OPCUAServerEndPoint } from "./server_end_point.js";
import { type CreateSessionOption, ServerEngine, type ServerEngineOptions } from "./server_engine.js";
import type { IServerEngineForServer } from "./server_engine_interface.js";
import type { ServerSession } from "./server_session.js";
import type { CreateMonitoredItemHook, DeleteMonitoredItemHook, Subscription } from "./server_subscription.js";
import { type UAUserManagerBase, type UserManagerOptions } from "./user_manager.js";
type ResponseClassType = typeof BrowseResponse | typeof BrowseNextResponse | typeof CallResponse | typeof CreateMonitoredItemsResponse | typeof CreateSubscriptionResponse | typeof DeleteSubscriptionsResponse | typeof HistoryReadResponse | typeof ModifyMonitoredItemsResponse | typeof ModifySubscriptionResponse | typeof ReadResponse | typeof RegisterNodesResponse | typeof RepublishResponse | typeof SetPublishingModeResponse | typeof SetTriggeringResponse | typeof TransferSubscriptionsResponse | typeof TranslateBrowsePathsToNodeIdsResponse | typeof UnregisterNodesResponse | typeof WriteResponse;
/**
 * the sampling function of a monitored item: a read of its node, found on the node objects or
 * on the compact address space
 * @internal exported for the engine tests
 */
export declare function prepareMonitoredItem(_context: ISessionContext, nodeFinder: INodeFinder, monitoredItem: MonitoredItem): void;
/**
 * OPC 10000-4 v1.05.07 §5.12.2: CallResponse.diagnosticInfos, one per result, in the order of the results. Empty unless
 * the Client asked for operation-level diagnostics and at least one result has something to report.
 *
 * Each entry starts from the DiagnosticInfo the method implementation returned. When `stringTable` is given, the
 * fields §7.12 defines as indexes into the ResponseHeader stringTable are filled for every non-Good result, according
 * to the bits the Client asked for (§7.32):
 * - SymbolicId (0x20): `symbolicId` is the symbolic name of the StatusCode, `namespaceURI` the OPC UA namespace it is
 *   defined in;
 * - LocalizedText (0x40): `localizedText` is the method's `statusText` (at most 256 bytes of UTF-8), else the standard
 *   description of the StatusCode; `locale` is the locale of `statusText`, when given.
 * A field the method already set is kept. A Good result gets only what its method returned, or its `statusText`.
 */
export declare function callResultDiagnosticInfos(returnDiagnostics: number, results: MethodResult[], stringTable?: string[]): DiagnosticInfo[];
export declare function filterDiagnosticInfo(returnDiagnostics: number, response: CallResponse): void;
export declare enum RegisterServerMethod {
    HIDDEN = 1,// the server doesn't expose itself to the external world
    MDNS = 2,// the server publish itself to the mDNS Multicast network directly
    LDS = 3
}
export interface OPCUAServerEndpointOptions {
    /**
     * the primary hostname of the endpoint.
     * @default getFullyQualifiedDomainName()
     */
    hostname?: string;
    /**
     * Host IP address or hostname where the TCP server listens for connections.
     * If omitted, defaults to listening on all network interfaces:
     * - Unspecified IPv6 address (::) if IPv6 is available,
     * - Unspecified IPv4 address (0.0.0.0) otherwise.
     * Use this to bind the server to a specific interface or IP.
     *
     * In an `endpoints[]` entry, it applies to that listener only; when the
     * entry has no `host`, the top-level `host` is used (then all interfaces).
     * Binding each listener to its own interface is how two networks get
     * different security settings (see `advertisedEndpoints` for the limits
     * of per-URL settings on a shared listener).
     *
     * note: `hostname` is what endpoint URLs advertise; `host` is where the
     * socket is bound. They are independent.
     */
    host?: string;
    /**
     * the TCP port to listen to.
     * @default 26543
     */
    port?: number;
    /**
     * share the port with other listeners in this process or others (SO_REUSEPORT, Linux): the
     * kernel spreads the incoming connections across them. Used by front threads, which all
     * listen on the same port.
     *
     * In an `endpoints[]` entry, it applies to that listener only; the top-level value is the fallback.
     */
    reusePort?: boolean;
    /**
     * the possible security policies that the server will expose
     * @default  [SecurityPolicy.None, SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes128_Sha256_RsaOaep, SecurityPolicy.Aes256_Sha256_RsaPss  ]
     */
    securityPolicies?: SecurityPolicy[];
    /**
     * the possible security mode that the server will expose
     * @default [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]
     */
    securityModes?: MessageSecurityMode[];
    /**
     * tells if the server default endpoints should allow anonymous connection.
     *
     * When `false`, `UserTokenType.Anonymous` is removed from the advertised
     * user token policies, even if it is listed in `userTokenTypes`.
     * @default true
     */
    allowAnonymous?: boolean;
    /**
     * the user identity token types that the endpoints advertise in their
     * `userIdentityTokens` (UserTokenPolicy) list.
     *
     * The server only accepts, at ActivateSession, a user identity token whose
     * type and policyId match one of the advertised UserTokenPolicies of the
     * endpoint the session was created on: any other token is rejected with
     * `BadIdentityTokenInvalid`. Restricting this list therefore restricts the
     * way users can authenticate, not only what is shown to clients.
     *
     * - `UserTokenType.Anonymous` is removed when `allowAnonymous` is `false`
     *   (`allowAnonymous: false` always wins).
     * - `UserTokenType.IssuedToken` is not supported yet and is ignored.
     * - the resulting list must not be empty, otherwise no client could ever
     *   activate a session: the server constructor throws.
     *
     * Per-URL lists in `advertisedEndpoints` can only restrict this list. They
     * all share this listener's socket, so a client presenting an unknown URL
     * (or the URL of another listener) is limited to the most restrictive list
     * of the listener it is connected to; to enforce a different list for some
     * clients, give them their own listener in `endpoints`.
     *
     * @example a "passwordless" server that only accepts X509 user certificates
     * ```ts
     * userTokenTypes: [UserTokenType.Certificate],
     * allowAnonymous: false
     * ```
     * @default [UserTokenType.Anonymous, UserTokenType.UserName, UserTokenType.Certificate]
     */
    userTokenTypes?: UserTokenType[];
    /**
     * when `true`, the endpoint with `SecurityPolicy.None` also advertises a
     * UserName token policy without any user token security policy
     * (policyId `username_unsecure`): the password is then sent in clear
     * text over an unsecured channel.
     *
     * This is strongly discouraged by OPC 10000-4 and is only meant for
     * legacy clients on trusted, isolated networks. It has no effect when
     * `UserTokenType.UserName` is not in `userTokenTypes` or when
     * `MessageSecurityMode.None` is not in `securityModes`.
     *
     * @default false
     */
    allowUnsecurePassword?: boolean;
    /** alternate hostname  or IP to use */
    alternateHostname?: string | string[];
    /**
     * Additional endpoint URL(s) to advertise.
     *
     * Use when the server is behind Docker port-mapping, a reverse proxy,
     * or a NAT gateway. Each URL is parsed to extract hostname and port.
     * Each entry can be a plain URL string (inherits all security
     * settings from the main endpoint) or an
     * `AdvertisedEndpointConfig` object with per-URL overrides.
     * The server still listens on `port`.
     *
     * @example "opc.tcp://localhost:48481"
     * @example ["opc.tcp://localhost:48481", { url: "opc.tcp://public:4840", securityModes: [MessageSecurityMode.SignAndEncrypt] }]
     */
    advertisedEndpoints?: AdvertisedEndpoint | AdvertisedEndpoint[];
    /**
     *  true, if discovery service on secure channel shall be disabled
     */
    disableDiscovery?: boolean;
}
export interface OPCUAServerOptions extends OPCUABaseServerOptions, OPCUAServerEndpointOptions {
    /**
     * @deprecated
     */
    alternateEndpoints?: OPCUAServerEndpointOptions[];
    endpoints?: OPCUAServerEndpointOptions[];
    /**
     * Reverse Connect (OPC UA Part 6 §7.1.3).
     *
     * When set, the server dials OUTBOUND to each listed client reverse-connect listener and
     * sends a ReverseHello ("RHE"), letting the client establish the SecureChannel over that
     * socket. This is useful when the server sits behind a firewall with no open inbound ports.
     *
     * All fields are optional and, when omitted, the server behaves exactly as before (no
     * outbound dialing).
     */
    reverseConnect?: ReverseConnectOptions;
    /**
     * the server certificate full path filename
     *
     * the certificate should be in PEM format
     */
    certificateFile?: string;
    /**
     * the server private key full path filename
     *
     * This file should contains the private key that has been used to generate
     * the server certificate file.
     *
     * the private key should be in PEM format
     *
     * If the key is encrypted, `serverCertificateManager` must be an
     * `OPCUACertificateManager` constructed with a matching
     * `privateKeyPassphrase` (or `privateKeyProvider`) — otherwise
     * `initialize()` fails closed.
     */
    privateKeyFile?: string;
    /**
     * the default secure token life time in ms.
     */
    defaultSecureTokenLifetime?: number;
    /**
     * the HEL/ACK transaction timeout in ms.
     *
     * Use a large value ( i.e 15000 ms) for slow connections or embedded devices.
     * @default 10000
     */
    timeout?: number;
    /**
     * the maximum number of simultaneous sessions allowed.
     * @default 10
     * @deprecated use serverCapabilities: { maxSessions: } instead

     */
    maxAllowedSessionNumber?: number;
    /**
     * the maximum number authorized simultaneous connections per endpoint
     * @default 10
     */
    maxConnectionsPerEndpoint?: number;
    /**
     * the NodeSet2 documents to load: file paths, and {@link NodesetSource} values for a
     * document that is not a file. A string is a path, as it was in `nodeset_filename`;
     * anything else is a source: a gzip file inflated on the way, an HTTP response, a string of
     * XML. They load in one call, in dependency order whatever the order given, so a source may
     * require a model given as a path and the other way round.
     *
     * When neither `nodesets` nor `nodeset_filename` is given, the standard nodeset is loaded.
     *
     * example:
     *
     * ```javascript
     * import { nodesets, nodesetSourceFromGzipFile, nodesetSourceFromUrl, OPCUAServer } from "node-opcua";
     * const server = new OPCUAServer({
     *     nodesets: [
     *         nodesets.standard,
     *         nodesets.di,
     *         nodesetSourceFromGzipFile("plant_model.xml.gz"),
     *         nodesetSourceFromUrl("https://models.example.com/plant.xml")
     *     ],
     *     nodesetLoaderOptions: { yieldEveryBytes: 1024 * 1024 }
     * });
     * ```
     */
    nodesets?: string | Array<string | NodesetSource>;
    /**
     * the nodeset.xml file(s) to load
     *
     * @deprecated use {@link OPCUAServerOptions.nodesets}: it takes the same file paths, plus
     * {@link NodesetSource} values for a gzip stream, an HTTP response or a string of XML.
     * Renaming the key is the whole migration. Still honoured; entries given here load
     * before those of `nodesets`.
     */
    nodeset_filename?: string[] | string;
    /**
     * how the nodesets load: `yieldEveryBytes` keeps the process responsive while a streamed
     * model loads, `imageStore` replays precompiled images, `permissions` and
     * `accessRestrictions` say what of the declared access policy is applied.
     */
    nodesetLoaderOptions?: NodeSetLoaderOptions;
    /**
     * the server Info
     *
     * this object contains the value that will populate the
     * Root/ObjectS/Server/ServerInfo OPCUA object in the address space.
     */
    serverInfo?: ApplicationDescriptionOptions;
    buildInfo?: {
        productName?: string;
        productUri?: string | null;
        manufacturerName?: string;
        softwareVersion?: string;
        buildNumber?: string;
        buildDate?: Date;
    };
    /**
     *  an object that implements user authentication methods
     */
    userManager?: UserManagerOptions;
    /**
     * how a Session's permission is resolved when neither the target Node nor its namespace
     * declares any RolePermissions:
     *
     *  - `"allow"` (default): grant every permission. This is how node-opcua has always behaved,
     *    and what most address spaces expect, since almost no server declares RolePermissions on
     *    its own Nodes.
     *  - `"deny"` : grant nothing. Fail-closed, for products that drive access entirely from
     *    declared policy. Expect to set DefaultRolePermissions on every namespace, otherwise the
     *    address space becomes unreadable to remote Sessions.
     *
     * This governs remote Sessions only. In-process callers keep every permission regardless.
     * @default "allow"
     */
    unresolvedPermissionPolicy?: UnresolvedPermissionPolicy;
    /** resource Path is a string added at the end of the url such as "/UA/Server" */
    resourcePath?: string;
    /**
     *
     */
    serverCapabilities?: ServerCapabilitiesOptions;
    /**
     * if server shall raise AuditingEvent
     * @default true
     */
    isAuditing?: boolean;
    /**
     * What CreateSessionResponse.serverCertificate carries when the server
     * certificate is CA-issued: `false` sends the leaf certificate only,
     * `true` sends the whole chain (leaf, then its issuers).
     *
     * A client computing the legacy ActivateSession signature (OPC 10000-4
     * §6.1.8) "may use the entire chain passed in ServerCertificate", and some
     * deployed clients do, so the leaf alone is the safer default. The
     * endpoint descriptions and the OpenSecureChannel sender certificate keep
     * the chain either way, and the server accepts a client signature over
     * the leaf or over the chain whichever is chosen.
     *
     * Also settable at runtime: {@link OPCUAServer.sendCertificateChainInCreateSession}.
     * @default false
     */
    sendCertificateChainInCreateSession?: boolean;
    /**
     * the Roles whose Sessions receive Audit Events.
     *
     * OPC 10000-2 v1.05.06 §4.14: "the ability to subscribe for Audit Events is restricted to appropriate users
     * and/or applications". An event MonitoredItem delivers an Event only to a Session that holds
     * ReceiveEvents on its EventType and on its SourceNode (OPC 10000-3 PermissionType bit 11), and
     * at start-up the server rewrites that one bit on AuditEventType and all its subtypes so that
     * these Roles, and only these, hold it. Every other permission the nodesets declare is kept: the
     * types stay browsable and readable by every Session. Opc.Ua.NodeSet2.xml already grants
     * ReceiveEvents on the standard audit types to SecurityAdmin alone, which is the default here.
     *
     * - `[WellKnownRoles.Anonymous]` hands Audit Events to every Session, the behaviour of
     *   node-opcua before ReceiveEvents was enforced.
     * - `null` leaves the RolePermissions exactly as the loaded nodesets declare them.
     *
     * A subtype created after start-up (Namespace.addEventType) is not covered and needs
     * RolePermissions of its own.
     *
     * @default [WellKnownRoles.SecurityAdmin]
     */
    auditEventRoles?: RoleIdLike[] | null;
    /**
     * OPC UA Part 4 §5.13.7 (TransferSubscriptions) rules that a Subscription created by an anonymous
     * session may only be transferred to another session when the SecureChannel MessageSecurityMode is
     * Sign or SignAndEncrypt and the client certificate's ApplicationUri is the one of the original
     * session. The conformant behaviour is the default: with `false`, an anonymous transfer over a
     * `MessageSecurityMode.None` channel is refused with `Bad_UserAccessDenied` (the CTT 1.05 script
     * "Subscription Transfer / Err-017" checks exactly this).
     *
     * Set it to `true` to relax the rule and accept anonymous-to-anonymous transfers over an unsecured
     * channel, the behaviour of node-opcua before 2.183.0. The relaxation only affects anonymous
     * sessions: the cross-user ownership check (a transfer is refused unless the destination session
     * operates on behalf of the same user as the subscription owner) is always enforced.
     * @default false
     */
    allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean;
    /**
     * a namespace of its own for the nodes the server creates while it runs: Sessions (their NodeId,
     * object and diagnostics) and the diagnostics of Subscriptions, kept apart from the server's own
     * namespace (1), where they go when this is not given. Registered when the server initializes.
     */
    diagnosticsNamespaceUri?: string;
    /**
     * strategy used by the server to declare itself to a discovery server
     *
     * - HIDDEN: the server doesn't expose itself to the external world
     * - MDNS: the server publish itself to the mDNS Multicast network directly
     * - LDS: the server registers itself to the LDS or LDS-ME (Local Discovery Server)
     *
     *  @default    .HIDDEN - by default the server
     *            will not register itself to the local discovery server
     *
     */
    registerServerMethod?: RegisterServerMethod;
    /**
     *
     * @default "opc.tcp://localhost:4840"]
     */
    discoveryServerEndpointUrl?: string;
    /**
     *
     *  supported server capabilities for the Multicast (mDNS)
     *  @default ["NA"]
     *  the possible values are any of node-opcua-discovery.serverCapabilities)
     *
     */
    capabilitiesForMDNS?: string[];
    /**
     * user Certificate Manager
     * this certificate manager holds the X509 certificates used
     * by client that uses X509 certificate token to impersonate a user
     */
    userCertificateManager?: OPCUACertificateManager;
    /**
     * Server Certificate Manager
     *
     * this certificate manager will be used by the server to access
     * and store certificates from the connecting clients
     */
    serverCertificateManager?: OPCUACertificateManager;
    /**
     *
     */
    onCreateMonitoredItem?: CreateMonitoredItemHook;
    onDeleteMonitoredItem?: DeleteMonitoredItemHook;
    /**
     * skipOwnNamespace to true, if you don't want the server to create
     * a dedicated namespace for its own (namespace=1).
     * Use this flag if you intend to load the server own namespace
     * from an external source.
     * @default false
     */
    skipOwnNamespace?: boolean;
    /**
     * a compact address space next to the node objects: the namespaces registered with
     * server.engine.registerCompactNamespace() live there, in typed columns, and the Read,
     * Write, Browse and TranslateBrowsePaths services answer them from there. It is loaded
     * with the same nodesets as the node objects, so that a compact node can hang under the
     * Objects folder. Subscriptions do not reach those nodes yet. The options of the store
     * (`{ shared: true }` for a store front threads read) may be given instead of true.
     */
    compactAddressSpace?: boolean | StoreAddressSpaceOptions;
    transportSettings?: IServerTransportSettings;
}
export interface OPCUAServerEvents {
    /** event raised when a new session is created */
    create_session: [session: ServerSession];
    /** event raised when a session is activated */
    session_activated: [session: ServerSession, userIdentityToken: UserIdentityToken];
    /** event raised when a session is closed */
    session_closed: [session: ServerSession, deleteSubscriptions: boolean];
    /** event raised after the server address space has been initialized */
    post_initialize: [];
    /**
     * emitted when the server is trying to register with the LDS
     * but the connection has failed (backoff signal)
     */
    serverRegistrationPending: [];
    /** event raised when server has been successfully registered on the LDS */
    serverRegistered: [];
    /** event raised when server registration has been successfully renewed on the LDS */
    serverRegistrationRenewed: [];
    /** event raised when server has been successfully unregistered from the LDS */
    serverUnregistered: [];
    /** event raised after the server has raised an OPCUA event toward a client */
    event: [eventData: unknown];
    /**
     * event raised when the server receives a request from a connected client.
     * Useful for trace/diagnostics.
     */
    request: [request: Request, channel: ServerSecureChannelLayer];
    /**
     * event raised when the server sends a response to a connected client.
     * Useful for trace/diagnostics.
     */
    response: [response: Response, channel: ServerSecureChannelLayer];
    /**
     * event raised when a new secure channel transport is initialized (HEL/ACK complete).
     * Note: securityPolicy and securityMode are NOT yet established at this point.
     * Use "channelSecured" for post-handshake notifications.
     */
    newChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    /**
     * event raised when a secure channel has completed the OpenSecureChannel handshake.
     * At this point securityPolicy, securityMode, and clientCertificate are available.
     */
    channelSecured: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    /** event raised when a secure channel is closed */
    closeChannel: [channel: ServerSecureChannelLayer, endpoint: OPCUAServerEndPoint];
    /**
     * event raised when the server refused a TCP connection from a client
     * (for instance because too many connections)
     */
    connectionRefused: [socketData: ISocketData, endpoint: OPCUAServerEndPoint];
    /**
     * event raised when an OpenSecureChannel has failed,
     * e.g. invalid certificate or malformed message
     */
    openSecureChannelFailure: [socketData: ISocketData, channelData: IChannelData, endpoint: OPCUAServerEndPoint];
    /**
     * event raised when a client sends an OpenSecureChannelRequest (Issue or Renew),
     * before the server processes it. The request is decoded: SecurityMode, RequestType,
     * RequestedLifetime and ClientNonce.
     */
    openSecureChannelRequest: [request: OpenSecureChannelRequest, channel: ServerSecureChannelLayer];
    /**
     * event raised when the server answers an OpenSecureChannelRequest: the
     * OpenSecureChannelResponse, or the ServiceFault that refuses the channel.
     */
    openSecureChannelResponse: [response: Response, channel: ServerSecureChannelLayer];
}
/**
 * The OPC UA server.
 *
 * `OPCUAServer` creates an OPC UA server that exposes an address space
 * to connected clients. It handles secure channel management, session
 * lifecycle, subscriptions, and the full OPC UA service set.
 *
 * @example
 * ```typescript
 * import { OPCUAServer, DataType, Variant } from "node-opcua";
 *
 * const server = new OPCUAServer({ port: 26543 });
 * await server.initialize();
 *
 * const addressSpace = server.engine.addressSpace!;
 * const namespace = addressSpace.getOwnNamespace();
 * const myVariable = namespace.addVariable({
 *     browseName: "Temperature",
 *     componentOf: addressSpace.rootFolder.objects,
 *     dataType: DataType.Double,
 * });
 * myVariable.setValueFromSource(
 *     new Variant({ dataType: DataType.Double, value: 22.5 })
 * );
 *
 * await server.start();
 * console.log("Server listening on",
 *     server.getEndpointUrl());
 *
 * // ... later ...
 * await server.shutdown();
 * ```
 */
/**
 * The services of an OPC UA server over an engine: the ServerEngine of this thread for an OPCUAServer, or one
 * that forwards to an engine elsewhere. What the services ask of the engine is IServerEngineForServer.
 * The static settings (OPCUAServer.defaultShutdownTimeout, ...) are read from OPCUAServer, where users set them.
 */
export declare abstract class OPCUAServerCore<E extends IServerEngineForServer = IServerEngineForServer> extends OPCUABaseServer<OPCUAServerEvents> {
    #private;
    engine: E;
    registerServerMethod: RegisterServerMethod;
    discoveryServerEndpointUrl: string;
    registerServerManager?: IRegisterServerManager;
    capabilitiesForMDNS: string[];
    userCertificateManager: OPCUACertificateManager;
    toJSON(): Record<string, unknown>;
    toString(): string;
    /**
     * total number of bytes written  by the server since startup
     */
    get bytesWritten(): number;
    /**
     * total number of bytes read  by the server since startup
     */
    get bytesRead(): number;
    /**
     * Number of transactions processed by the server since startup
     */
    get transactionsCount(): number;
    /**
     * The server build info
     */
    get buildInfo(): BuildInfo;
    /**
     * the number of connected channel on all existing end points
     */
    get currentChannelCount(): number;
    /**
     * The number of active subscriptions from all sessions
     */
    get currentSubscriptionCount(): number;
    /**
     * the number of session activation requests that have been rejected
     */
    get rejectedSessionCount(): number;
    /**
     * the number of request that have been rejected
     */
    get rejectedRequestsCount(): number;
    /**
     * the number of sessions that have been aborted
     */
    get sessionAbortCount(): number;
    /**
     * the publishing interval count
     */
    get publishingIntervalCount(): number;
    /**
     * the number of sessions currently active
     */
    get currentSessionCount(): number;
    /**
     * true if the server has been initialized
     *
     */
    get initialized(): boolean;
    /**
     * is the server auditing ?
     */
    get isAuditing(): boolean;
    /**
     * Set the current server state.
     *
     * Updates both the internal state and the
     * `Server.ServerStatus.State` variable in the
     * address space so that OPC UA reads reflect the
     * new state immediately.
     */
    setServerState(serverState: ServerState): void;
    /**
     * Read the current `ServerState` from the
     * internal server status.
     */
    getServerState(): ServerState;
    /**
     * Set or clear a temporary role-policy override.
     *
     * When set, the override's `getUserRoles(username)`
     * is called **before** the default `userManager`.
     * Returning a `NodeId[]` overrides the roles;
     * returning `null` falls through to the default.
     *
     * Call with `null` to remove the override and
     * restore default behavior.
     */
    setRolePolicyOverride(override: IRolePolicyOverride | null): void;
    /**
     * Set `ServerConfiguration.InApplicationSetup` in
     * the address space.
     *
     * Indicates whether the server is in its initial
     * application setup phase (e.g. awaiting GDS
     * provisioning).
     */
    setInApplicationSetup(value: boolean): void;
    /**
     * Read the current value of
     * `ServerConfiguration.InApplicationSetup`.
     */
    getInApplicationSetup(): boolean;
    /**
     * Collect additional hostnames for the self-signed certificate SAN.
     *
     * Merges hostnames from `alternateHostname` and parsed
     * `advertisedEndpoints` URLs so the certificate covers all
     * configured addresses.
     *
     * IP literals (v4/v6) are **excluded** — they are handled by
     * `getConfiguredIPs()` and placed in the SAN `iPAddress` entries.
     *
     * @internal
     */
    getConfiguredHostnames(): string[];
    /**
     * Collect additional IP addresses for the self-signed certificate SAN.
     *
     * Merges IP literals from `alternateHostname` and parsed
     * `advertisedEndpoints` URLs so the certificate covers all
     * configured IP addresses.
     *
     * @internal
     */
    getConfiguredIPs(): string[];
    /**
     * Classify all values from `alternateHostname` and
     * `advertisedEndpoints` into hostnames vs IP addresses using
     * `isIPAddress()` (wraps `net.isIP()`).
     */
    private _collectAlternateValues;
    /**
     * the maximum number of concurrent sessions allowed on the server
     */
    get maxAllowedSessionNumber(): number;
    /**
     * the maximum number for concurrent connection per end point
     */
    maxConnectionsPerEndpoint: number;
    /**
     * false if anonymous connection are not allowed
     */
    allowAnonymous: boolean;
    /**
     * the user manager
     */
    userManager: UAUserManagerBase;
    /**
     * Additional role resolvers (OPC 10000-18 §4.4).
     * Packages like node-opcua-role-set-server push resolvers here.
     */
    roleResolvers: IRoleResolver[];
    /**
     * how a remote Session's permission is resolved when no RolePermissions apply.
     * @default "allow"
     * @see OPCUAServerOptions.unresolvedPermissionPolicy
     */
    unresolvedPermissionPolicy: UnresolvedPermissionPolicy;
    /**
     * true: CreateSessionResponse.serverCertificate carries the whole chain;
     * false: the leaf certificate only. Read at each CreateSession.
     * @see OPCUAServerOptions.sendCertificateChainInCreateSession
     */
    sendCertificateChainInCreateSession: boolean;
    readonly options: OPCUAServerOptions;
    private objectFactory?;
    private _delayInit?;
    constructor(options?: OPCUAServerOptions);
    /**
     * Initialize the server by installing default node set.
     *
     * and instruct the server to listen to its endpoints.
     *
     * ```javascript
     * const server = new OPCUAServer();
     * await server.initialize();
     *
     * // default server namespace is now initialized
     * // it is a good time to create life instance objects
     * const namespace = server.engine.addressSpace.getOwnNamespace();
     * namespace.addObject({
     *     browseName: "SomeObject",
     *     organizedBy: server.engine.addressSpace.rootFolder.objects
     * });
     *
     * // the addressSpace is now complete
     * // let's now start listening to clients
     * await server.start();
     * ```
     */
    initialize(): Promise<void>;
    initialize(done: () => void): void;
    /** gives a monitored item its sampling function, as the items of the subscriptions the server creates get it */
    protected prepareSamplingOf(context: ISessionContext, monitoredItem: MonitoredItem): void;
    /** false once the engine is gone (shutdown): its address space, where monitored items find their nodes */
    protected engineServesSubscriptions(): boolean;
    /** what the server installs in the address space of its engine once loaded; an error if it cannot */
    protected afterEngineInitialized(): Error | null;
    /**
     * Initiate the server by starting all its endpoints
     */
    start(): Promise<void>;
    start(done: () => void): void;
    /**
     * Initiate the server by starting all its endpoints
     * @private
     */
    startAsync(): Promise<void>;
    /**
     * shutdown all server endpoints
     * @param  timeout the timeout (in ms) before the server is actually shutdown
     *
     * @example
     *
     * ```javascript
     *    // shutdown immediately
     *    server.shutdown(function(err) {
     *    });
     * ```
     * ```ts
     *   // in typescript with promises
     *   server.shutdown(10000).then(()=>{
     *      console.log("Server has shutdown");
     *   });
     * ```
     * ```javascript
     *    // shutdown within 10 seconds
     *    server.engine.shutdownReason = coerceLocalizedText("Shutdown for maintenance");
     *    server.shutdown(10000,function(err) {
     *    });
     *   ```
     */
    shutdown(timeout?: number): Promise<void>;
    shutdown(callback: (err?: Error) => void): void;
    shutdown(timeout: number, callback: (err?: Error) => void): void;
    dispose(): void;
    raiseEvent(eventType: "AuditSessionEventType", options: RaiseEventAuditSessionEventData): void;
    raiseEvent(eventType: "AuditCreateSessionEventType", options: RaiseEventAuditCreateSessionEventData): void;
    raiseEvent(eventType: "AuditActivateSessionEventType", options: RaiseEventAuditActivateSessionEventData): void;
    raiseEvent(eventType: "AuditCreateSessionEventType", options: RaiseEventData): void;
    raiseEvent(eventType: "AuditConditionCommentEventType", options: RaiseEventAuditConditionCommentEventData): void;
    raiseEvent(eventType: "AuditUrlMismatchEventType", options: RaiseEventAuditUrlMismatchEventTypeData): void;
    raiseEvent(eventType: "TransitionEventType", options: RaiseEventTransitionEventData): void;
    raiseEvent(eventType: "AuditCertificateInvalidEventType", options: RaiseAuditCertificateInvalidEventData): void;
    raiseEvent(eventType: "AuditCertificateExpiredEventType", options: RaiseAuditCertificateExpiredEventData): void;
    raiseEvent(eventType: "AuditCertificateUntrustedEventType", options: RaiseAuditCertificateUntrustedEventData): void;
    raiseEvent(eventType: "AuditCertificateRevokedEventType", options: RaiseAuditCertificateRevokedEventData): void;
    raiseEvent(eventType: "AuditCertificateMismatchEventType", options: RaiseAuditCertificateMismatchEventData): void;
    /**
     * create and register a new session
     * @private
     */
    protected createSession(options: CreateSessionOption): ServerSession;
    /**
     * retrieve a session by authentication token
     * @private
     */
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
    /**
     *
     * @param channel
     * @param clientCertificate
     * @param clientNonce
     * @private
     */
    protected computeServerSignature(channel: ServerSecureChannelLayer, clientCertificate: Certificate, clientNonce: Nonce): SignatureData | undefined;
    /**
     * {@link computeServerSignature} through the opaque key-operations path,
     * so the server's application instance key may be HSM/KMS-held. Default
     * implementation delegates to a subclass's `computeServerSignature`
     * override when one exists (so existing subclasses keep their behavior),
     * and signs through the channel-pinned key operations otherwise.
     * @private
     */
    protected computeServerSignatureAsync(channel: ServerSecureChannelLayer, clientCertificate: Certificate, clientNonce: Nonce): Promise<SignatureData | undefined>;
    /**
     *
     * @param session
     * @param channel
     * @param clientSignature
     */
    protected verifyClientSignature(session: ServerSession, channel: ServerSecureChannelLayer, clientSignature: SignatureData): boolean;
    protected isValidUserNameIdentityToken(channel: ServerSecureChannelLayer, _session: ServerSession, userTokenPolicy: UserTokenPolicy, userIdentityToken: UserNameIdentityToken, _userTokenSignature: SignatureData, callback: (err: Error | null, statusCode?: StatusCode) => void): void;
    protected isValidX509IdentityToken(channel: ServerSecureChannelLayer, session: ServerSession, userTokenPolicy: UserTokenPolicy, userIdentityToken: X509IdentityToken, userTokenSignature: SignatureData, callback: (err: Error | null, statusCode?: StatusCode) => void): void;
    /**
     * @internal
     */
    protected userNameIdentityTokenAuthenticateUser(channel: ServerSecureChannelLayer, session: ServerSession, userTokenPolicy: UserTokenPolicy, userIdentityToken: UserNameIdentityToken, callback: (err: Error | null, isAuthorized?: boolean, statusCode?: StatusCode) => void): void;
    /**
     * @internal
     */
    protected isValidUserIdentityToken(channel: ServerSecureChannelLayer, session: ServerSession, userIdentityToken: UserIdentityToken, userTokenSignature: SignatureData, endpointDescription: EndpointDescription, callback: (err: Error | null, statusCode?: StatusCode) => void): void;
    /**
     *
     * @internal
     * @param channel
     * @param session
     * @param userIdentityToken
     * @param callback
     * @returns {*}
     */
    protected isUserAuthorized(channel: ServerSecureChannelLayer, session: ServerSession, userIdentityToken: UserIdentityToken, callback: (err: Error | null, isAuthorized?: boolean, statusCode?: StatusCode) => void): void;
    protected makeServerNonce(): Nonce;
    protected _on_CreateSessionRequest(message: Message, channel: ServerSecureChannelLayer): Promise<void>;
    /**
     *
     * @private
     *
     *
     */
    protected _on_ActivateSessionRequest(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     * an ActivateSession about to be answered: a server that keeps its sessions in another thread
     * (FrontOPCUAServer) records the activation there first, so that once the client has its answer,
     * the session is active wherever the server is read from. Nothing to wait for here.
     */
    protected recordActivation(_session: ServerSession): Promise<void> | undefined;
    /**
     * @internal the requests this server answers from their bytes (see ServerSecureChannelParent.leanRequestHandler):
     * none here, FrontOPCUAServer answers the Reads it serves in place
     */
    protected leanRequestHandler(): OPCUAServerEndPoint["leanRequestHandler"];
    /**
     * an ActivateSession refused: the session stays as it was (FrontOPCUAServer gives back one it took,
     * and the refusal is answered once it is back)
     */
    protected activationRefused(_session: ServerSession): Promise<void> | undefined;
    protected prepare(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     * ensure that action is performed on a valid session object,
     * @param ResponseClass the constructor of the response Class
     * @param message
     * @param channel
     * @param actionToPerform
     * @param actionToPerform.session {ServerSession}
     * @param actionToPerform.sendResponse
     * @param actionToPerform.sendResponse.response
     * @param actionToPerform.sendError
     * @param actionToPerform.sendError.statusCode
     * @param actionToPerform.sendError.diagnostics
     *
     * @private
     */
    protected _apply_on_SessionObject(ResponseClass: ResponseClassType, message: Message, channel: ServerSecureChannelLayer, actionToPerform: (session: ServerSession, sendResponse: (response: Response) => void, sendError: (statusCode: StatusCode) => void) => void | Promise<void>): Promise<void>;
    protected _apply_on_Subscription(ResponseClass: ResponseClassType, message: Message, channel: ServerSecureChannelLayer, actionToPerform: (session: ServerSession, subscription: Subscription, sendResponse: (response: Response) => void, sendError: (statusCode: StatusCode) => void) => Promise<void>): Promise<void>;
    protected _apply_on_SubscriptionIds<T>(ResponseClass: typeof SetPublishingModeResponse | typeof TransferSubscriptionsResponse | typeof DeleteSubscriptionsResponse, message: Message, channel: ServerSecureChannelLayer, actionToPerform: (session: ServerSession, subscriptionId: number) => Promise<T>): void;
    protected _apply_on_Subscriptions(ResponseClass: typeof SetPublishingModeResponse | typeof TransferSubscriptionsResponse | typeof DeleteSubscriptionsResponse, message: Message, channel: ServerSecureChannelLayer, actionToPerform: (session: ServerSession, subscription: Subscription) => Promise<StatusCode>): void;
    private _closeSession;
    /**
     * @param message
     * @param channel
     * @private
     */
    protected _on_CloseSessionRequest(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     * @param message
     * @param channel
     * @private
     */
    protected _on_BrowseRequest(message: Message, channel: ServerSecureChannelLayer): void;
    /**
     */
    protected _on_BrowseNextRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_ReadRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_HistoryReadRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_WriteRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_CreateSubscriptionRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_DeleteSubscriptionsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_TransferSubscriptionsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_CreateMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_ModifySubscriptionRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_ModifyMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_PublishRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_SetPublishingModeRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_DeleteMonitoredItemsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_SetTriggeringRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _beforeDeleteSubscription(subscription: Subscription): Promise<void>;
    protected _on_RepublishRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_SetMonitoringModeRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_TranslateBrowsePathsToNodeIdsRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_CallRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_RegisterNodesRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_UnregisterNodesRequest(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_Cancel(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_AddNodes(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_AddReferences(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_DeleteNodes(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_DeleteReferences(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_QueryFirst(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_QueryNext(message: Message, channel: ServerSecureChannelLayer): void;
    protected _on_HistoryUpdate(message: Message, channel: ServerSecureChannelLayer): void;
    private createEndpoint;
    private createEndpointDescriptions;
    initializeCM(): Promise<void>;
    /** the engine the services run on, created once the endpoints can be described */
    protected abstract createEngine(options: ServerEngineOptions): E;
}
/** the OPC UA server, with its engine and address space in this thread */
export declare class OPCUAServer extends OPCUAServerCore<ServerEngine> {
    static defaultShutdownTimeout: number;
    /**
     * if requestExactEndpointUrl is set to true the server will only accept createSession that have a endpointUrl that strictly matches
     * one of the provided endpoint.
     * This mean that if the server expose a endpoint with url such as opc.tcp://MYHOSTNAME:1234, client will not be able to reach the server
     * with the ip address of the server.
     * requestExactEndpointUrl = true => emulates the Prosys Server behavior
     * requestExactEndpointUrl = false => emulates the Unified Automation behavior.
     */
    static requestExactEndpointUrl: boolean;
    static registry: ObjectRegistry;
    static fallbackSessionName: string;
    /**
     * the maximum number of subscription that can be created per server
     * @deprecated
     */
    static deprecated_MAX_SUBSCRIPTION: number;
    protected createEngine(options: ServerEngineOptions): ServerEngine;
}
export interface RaiseEventAuditEventData extends RaiseEventData {
    actionTimeStamp: PseudoVariantDateTime;
    status: PseudoVariantBoolean;
    serverId: PseudoVariantString;
    /**
     * ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
     */
    clientAuditEntryId: PseudoVariantString;
    /**
     * The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
     * obtained from the UserIdentityToken passed in the ActivateSession call.
     */
    clientUserId: PseudoVariantString;
    sourceName: PseudoVariantString;
}
export interface RaiseEventAuditUpdateMethodEventData extends RaiseEventAuditEventData {
    methodId: PseudoVariantNodeId;
    inputArguments: PseudoVariant | Variant | UAEventType | undefined;
}
export interface RaiseEventAuditConditionCommentEventData extends RaiseEventAuditUpdateMethodEventData {
    eventId: PseudoVariantByteString;
    comment: PseudoVariantLocalizedText;
}
export interface RaiseEventAuditSessionEventData extends RaiseEventAuditEventData {
    /**
     *  part 5 - 6.4.7 AuditSessionEventType
     */
    sessionId: PseudoVariantNodeId;
}
export interface RaiseEventAuditCreateSessionEventData extends RaiseEventAuditSessionEventData {
    sessionId: PseudoVariantNodeId;
    /**
     *  part 5 - 6.4.8 AuditCreateSessionEventType
     *  SecureChannelId shall uniquely identify the SecureChannel.
     *  The application shall use the same identifier in
     *  all AuditEvents related to the Session Service Set (AuditCreateSessionEventType, AuditActivateSessionEventType
     *  and their subtypes) and the SecureChannel Service Set (AuditChannelEventType and its subtype
     */
    secureChannelId: PseudoVariantString;
    revisedSessionTimeout: PseudoVariantDuration;
    clientCertificate: PseudoVariantByteString;
    clientCertificateThumbprint: PseudoVariantString;
}
export interface RaiseEventAuditActivateSessionEventData extends RaiseEventAuditSessionEventData {
    /**
     * part 5 - 6.4.10 AuditActivateSessionEventType
     */
    clientSoftwareCertificates: PseudoVariantExtensionObjectArray;
    /**
     * UserIdentityToken reflects the userIdentityToken parameter of the ActivateSession Service call.
     * For Username/Password tokens the password should NOT be included.
     */
    userIdentityToken: PseudoVariantExtensionObject;
    /**
     * SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same identifier
     * in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
     * AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
     * (AuditChannelEventType and its subtypes).
     */
    secureChannelId: PseudoVariantString;
}
export interface RaiseEventTransitionEventData extends RaiseEventData {
}
export interface RaiseEventAuditUrlMismatchEventTypeData extends RaiseEventData {
    endpointUrl: PseudoVariantString;
}
/**
 * The SourceName for Events of this type shall be “Security/Certificate”.
 */
export interface RaiseAuditCertificateEventData extends RaiseEventData {
    certificate: PseudoVariantByteString;
    sourceName: PseudoVariantStringPredefined<"Security/Certificate">;
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 * Either the InvalidHostname or InvalidUri shall be provided.
 */
export interface RaiseAuditCertificateDataMismatchEventData extends RaiseAuditCertificateEventData {
    /**
     * InvalidHostname is the string that represents the host name passed in as part of the URL
     * that is found to be invalid. If the host name was not invalid it can be null.
     */
    invalidHostname: PseudoVariantString;
    invalidUri: PseudoVariantString;
}
export interface RaiseAuditCertificateUntrustedEventData extends RaiseAuditCertificateEventData {
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 *
 * The SourceName for Events of this type shall be “Security/Certificate”.
 *
 * The Message Variable shall include a description of why the certificate was expired
 * (i.e. time before start or time after end).
 *
 * There are no additional Properties defined for this EventType.
 *
 */
export interface RaiseAuditCertificateExpiredEventData extends RaiseAuditCertificateEventData {
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 *
 * The SourceName for Events of this type shall be “Security/Certificate”.
 *
 * The Message shall include a description of why the certificate is invalid.
 *
 * There are no additional Properties defined for this EventType.
 */
export interface RaiseAuditCertificateInvalidEventData extends RaiseAuditCertificateEventData {
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 *
 * The SourceName for Events of this type shall be “Security/Certificate”.
 *
 * The Message Variable shall include a description of why the certificate is not trusted.
 * If a trust chain is involved then the certificate that failed in the trust chain should be described.
 * There are no additional Properties defined for this EventType.
 */
export interface RaiseAuditCertificateUntrustedEventData extends RaiseAuditCertificateEventData {
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 *
 * The SourceName for Events of this type shall be “Security/Certificate”.
 *
 * The Message Variable shall include a description of why the certificate is revoked
 * (was the revocation list unavailable or was the certificate on the list).
 *
 *  There are no additional Properties defined for this EventType.
 */
export interface RaiseAuditCertificateRevokedEventData extends RaiseAuditCertificateEventData {
    sourceName: PseudoVariantStringPredefined<"Security/Certificate">;
}
/**
 * This EventType inherits all Properties of the AuditCertificateEventType.
 *
 * The SourceName for Events of this type shall be “Security/Certificate”.
 *
 * The Message Variable shall include a description of misuse of the certificate.
 *
 * There are no additional Properties defined for this EventType
 */
export interface RaiseAuditCertificateMismatchEventData extends RaiseAuditCertificateEventData {
}
export {};
//# sourceMappingURL=opcua_server.d.ts.map