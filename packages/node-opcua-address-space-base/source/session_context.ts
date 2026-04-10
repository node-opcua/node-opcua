import type { Certificate } from "node-opcua-crypto/web";
import type { DataValue } from "node-opcua-data-value";
import type { PreciseClock } from "node-opcua-date-time";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";
import type { MessageSecurityMode, PermissionType, ReferenceDescription, UserIdentityToken } from "node-opcua-types";
import type { BaseNode } from "./base_node";
import type { ContinuationPoint } from "./continuation_point";
import type { UAObject } from "./ua_object";
import type { UAObjectType } from "./ua_object_type";

export function getContextMaxMessageSize(context: ISessionContext): number {
    if (!context.session?.channel?.getTransportSettings) return 0;
    const f = context.session?.channel?.getTransportSettings();
    return f ? f.maxMessageSize : 0;
}

export interface ITransportSettings {
    maxMessageSize: number;
}
export interface IChannelBase {
    clientCertificate: Certificate | null;
    // clientNonce: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: string;
    getTransportSettings(): ITransportSettings;
}

export interface IContinuationPointInfo<T> {
    values: T[] | null;
    continuationPoint: ContinuationPoint | undefined;
    statusCode: StatusCode;
}
export interface ContinuationData {
    continuationPoint?: ContinuationPoint | null;
    releaseContinuationPoints?: boolean;
}
export interface IContinuationPointManager {
    //
    registerHistoryReadRaw(
        maxElements: number,
        values: DataValue[],
        continuationData: ContinuationData
    ): IContinuationPointInfo<DataValue>;
    getNextHistoryReadRaw(numValues: number, continuationData: ContinuationData): IContinuationPointInfo<DataValue>;
    //
    registerReferences(
        maxElements: number,
        values: ReferenceDescription[],
        continuationData: ContinuationData
    ): IContinuationPointInfo<ReferenceDescription>;
    getNextReferences(numValues: number, continuationData: ContinuationData): IContinuationPointInfo<ReferenceDescription>;
    dispose(): void;
}

export interface ISessionBase {
    userIdentityToken?: UserIdentityToken;
    channel?: IChannelBase;
    getSessionId(): NodeId; // session NodeID
    continuationPointManager: IContinuationPointManager;
}
export interface ContinuationPointData {
    dataValues: DataValue[];
}
export interface ISessionContext {
    /** The underlying OPC UA session, if available. */
    readonly session?: ISessionBase;

    /** Returns the user name of the current user. */
    getUserName(): string;

    /** Returns the NodeIds of all roles assigned to the current user. */
    getCurrentUserRoles(): NodeId[];

    /** Check whether the current user has the given permission on a node. */
    checkPermission(node: BaseNode, action: PermissionType): boolean;

    /** Returns `true` if browsing the given node is restricted for the current user. */
    isBrowseAccessRestricted(node: BaseNode): boolean;

    /** Returns `true` if the current user has the given role. */
    currentUserHasRole(role: NodeIdLike): boolean;

    /** Returns `true` if access to the node is restricted by security settings. */
    isAccessRestricted(node: BaseNode): boolean;

    /** The object on which the current operation is being performed. */
    object?: UAObject | UAObjectType;

    /** Server timestamp at the time the request was received. */
    currentTime?: PreciseClock;

    /**
     * The client's application-instance certificate,
     * or `null` if no secure channel is available.
     */
    readonly clientCertificate: Certificate | null;

    /**
     * The application URI extracted from the client
     * certificate's SubjectAltName, or `null` if
     * unavailable.
     */
    readonly clientApplicationUri: string | null;

    /**
     * Returns a JSON representation of the context
     */
    toJSON(): Record<string, string | null>;

    /**
     * Returns a string representation of the context
     */
    toString(): string;
}
