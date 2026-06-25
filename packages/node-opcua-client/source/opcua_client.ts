/**
 * @module node-opcua-client
 */

import type { DataTypeExtractStrategy } from "node-opcua-client-dynamic-extension-object";
import type { ResponseCallback } from "node-opcua-pseudo-session";
import type { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";
import type { CallbackT, ErrorCallback, StatusCode } from "node-opcua-status-code";
import type {
    FindServersRequestLike,
    GetEndpointsOptions,
    OPCUAClientBase,
    OPCUAClientBaseEvents,
    OPCUAClientBaseOptions
} from "./client_base";
import type { ClientSession } from "./client_session";
import type { ClientSubscription, ClientSubscriptionOptions } from "./client_subscription";
import { OPCUAClientImpl } from "./private/opcua_client_impl";
import type { UserIdentityInfo } from "./user_identity_info";

export interface OPCUAClientOptions extends OPCUAClientBaseOptions {
    /**
     * the requested session timeout in CreateSession (ms)
     *
     * Note:
     *    - make sure that this value is large enough, especially larger than the
     *      time between two transactions to the server.
     *
     *    - If your client establishes a subscription with the server, make sure that
     *      (maxKeepAliveCount * publishingInterval) calculated with negotiated values
     *      from the server  stay by large below the session time out, as you make
     *      encountered unexpected behavior.
     *
     * @default 60000 - default value is 60 secondes
     */
    requestedSessionTimeout?: number;

    /**
     *  @deprecated(use endpointMustExist instead)
     */
    endpoint_must_exist?: boolean;
    /**
     * set to false if the client should accept server endpoint mismatch
     * @default true
     */
    endpointMustExist?: boolean;

    /**
     * optional parameter to specify strategy used to extract DataTypeDefinition from server
     * default value : "Auto" : the client will attempt to extract DataTypeDefinition using the most efficient strategy
     */
    dataTypeExtractStrategy?: DataTypeExtractStrategy;
}

export interface EndpointWithUserIdentity {
    endpointUrl: string;
    userIdentity: UserIdentityInfo;
}
export type WithSessionFunc = (session: ClientSession) => Promise<void>;
export type WithSessionFuncP<T> = (session: ClientSession) => Promise<T>;
export type WithSubscriptionFunc = (session: ClientSession, subscription: ClientSubscription) => Promise<void>;
export type WithSubscriptionFuncP<T> = (session: ClientSession, subscription: ClientSubscription) => Promise<T>;

/**
 * The OPC UA client interface.
 *
 * `OPCUAClient` provides methods to connect to an OPC UA server,
 * create sessions, and manage the client lifecycle.
 *
 * Use {@link OPCUAClient.create} to instantiate a client.
 *
 * @example
 * ```typescript
 * const client = OPCUAClient.create({ endpointMustExist: false });
 * await client.connect("opc.tcp://localhost:26543");
 * const session = await client.createSession();
 * // ... use the session ...
 * await session.close();
 * await client.disconnect();
 * ```
 */
export interface OPCUAClient<Events extends OPCUAClientBaseEvents = OPCUAClientBaseEvents> extends OPCUAClientBase<Events> {
    /**
     * Connect the client to the specified OPC UA server endpoint.
     *
     * The client will establish a secure channel, negotiate security
     * parameters, and verify the server certificate.
     *
     * @param endpointUrl - the OPC UA endpoint URL (e.g. `"opc.tcp://host:4840"`)
     */
    connect(endpointUrl: string): Promise<void>;
    connect(endpointUrl: string, callback: ErrorCallback): void;

    /**
     * Disconnect the client from the server.
     *
     * This closes all active sessions, subscriptions, and the
     * underlying secure channel.
     */
    disconnect(): Promise<void>;
    disconnect(callback: ErrorCallback): void;

    /**
     * Retrieve the list of endpoints exposed by the server.
     *
     * @param options - optional filter criteria for the endpoint query
     * @returns the array of endpoint descriptions advertised by the server
     */
    getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;

    getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;

    getEndpoints(callback: ResponseCallback<EndpointDescription[]>): void;

    /**
     * Discover OPC UA servers registered on the network.
     *
     * @param options - optional filter criteria for the discovery query
     * @returns the array of discovered server application descriptions
     */
    findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;

    findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;

    findServers(callback: ResponseCallback<ApplicationDescription[]>): void;

    /**
     * Create a new session on the connected server.
     *
     * If `userIdentityInfo` is not provided, an anonymous session
     * is created.
     *
     * @param userIdentityInfo - optional credentials for user authentication
     * @returns the newly created client session
     */
    createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;

    createSession(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession(callback: (err: Error | null, session?: ClientSession) => void): void;

    /**
     * Create a new session, using createSession2 service (OPC UA 1.04+).
     *
     * @param userIdentityInfo - optional credentials for user authentication
     * @returns the newly created client session
     */
    createSession2(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;

    createSession2(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession2(callback: (err: Error | null, session?: ClientSession) => void): void;

    /** @deprecated */
    changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo): Promise<StatusCode>;
    changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo, callback: CallbackT<StatusCode>): void;

    /**
     * Close a previously created session.
     *
     * @param session - the session to close
     * @param deleteSubscriptions - if `true`, all subscriptions
     *   associated with the session are deleted on the server
     */
    closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;

    closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;

    /**
     * Reactivate a session that was previously transferred or
     * disconnected.
     *
     * @param session - the session to reactivate
     */
    reactivateSession(session: ClientSession): Promise<void>;

    reactivateSession(session: ClientSession, callback: (err?: Error) => void): void;

    /** @internal */
    createDefaultCertificate(): Promise<void>;

    /**
     * Connect to a server, execute an async function within a session,
     * then automatically close the session and disconnect.
     *
     * This is a convenience method for simple one-shot operations.
     *
     * @param endpointUrl - the server endpoint URL or endpoint with credentials
     * @param inner_func - the async function to execute with the session
     * @returns the value returned by `inner_func`
     *
     * @example
     * ```typescript
     * const result = await client.withSessionAsync(
     *     "opc.tcp://localhost:26543",
     *     async (session) => {
     *         return await session.read({ nodeId: "ns=0;i=2258",
     *             attributeId: AttributeIds.Value });
     *     }
     * );
     * ```
     */
    withSessionAsync<T>(endpointUrl: string | EndpointWithUserIdentity, inner_func: WithSessionFuncP<T>): Promise<T>;

    /**
     * Connect to a server, create a session and a subscription,
     * execute an async function, then clean up everything.
     *
     * This is a convenience method for subscription-based operations.
     *
     * @param endpointUrl - the server endpoint URL or endpoint with credentials
     * @param parameters - subscription creation parameters
     * @param inner_func - the async function to execute with the session and subscription
     * @returns the value returned by `inner_func`
     */
    withSubscriptionAsync<T>(
        endpointUrl: string | EndpointWithUserIdentity,
        parameters: ClientSubscriptionOptions,
        inner_func: WithSubscriptionFuncP<T>
    ): Promise<T>;
}

/**
 * Factory class for creating OPC UA client instances.
 *
 * @example
 * ```typescript
 * import { OPCUAClient } from "node-opcua-client";
 *
 * const client = OPCUAClient.create({
 *     endpointMustExist: false,
 *     requestedSessionTimeout: 60000,
 * });
 * ```
 */
export class OPCUAClient {
    /**
     * Create a new OPC UA client instance.
     *
     * @param options - client configuration options
     * @returns a configured OPC UA client ready to connect
     */
    public static create(options: OPCUAClientOptions): OPCUAClient {
        return new OPCUAClientImpl(options) as unknown as OPCUAClient;
    }
    /**
     * Convenience method to create a client, connect, and establish
     * a session in one call.
     *
     * @param endpointUrl - the OPC UA endpoint URL
     * @param userIdentity - optional user credentials
     * @param clientOptions - optional client configuration
     * @returns a connected client session
     *
     * @example
     * ```typescript
     * const session = await OPCUAClient.createSession(
     *     "opc.tcp://localhost:26543"
     * );
     * const dataValue = await session.read({
     *     nodeId: "ns=0;i=2258",
     *     attributeId: AttributeIds.Value,
     * });
     * await session.close(true); // deleteSubscriptions = true
     * ```
     */
    public static async createSession(
        endpointUrl: string,
        userIdentity?: UserIdentityInfo,
        clientOptions?: OPCUAClientOptions
    ): Promise<ClientSession> {
        return OPCUAClientImpl.createSession(endpointUrl, userIdentity, clientOptions);
    }
    public static set minimumRevisedSessionTimeout(minimumRevisedSessionTimeout: number) {
        OPCUAClientImpl.minimumRevisedSessionTimeout = minimumRevisedSessionTimeout;
    }
    public static get minimumRevisedSessionTimeout(): number {
        return OPCUAClientImpl.minimumRevisedSessionTimeout;
    }
}
