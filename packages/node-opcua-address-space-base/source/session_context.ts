import { Certificate } from "node-opcua-crypto";
import { DataValue } from "node-opcua-data-value";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { MessageSecurityMode, PermissionType, ReferenceDescription, UserIdentityToken } from "node-opcua-types";
import { StatusCode } from "node-opcua-status-code";

import { ContinuationPoint } from "./continuation_point";
import { BaseNode } from "./base_node";
import { UAObject } from "./ua_object";
import { UAObjectType } from ".";

export interface IChannelBase {
    clientCertificate: Certificate | null;
    // clientNonce: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: string;
}

export interface IContinuationPointInfo<T> {
    values: T[] | null;
    continuationPoint: ContinuationPoint | undefined;
    statusCode: StatusCode;
}
export interface ContinuationData {
    continuationPoint: ContinuationPoint | null;
    releaseContinuationPoints?: boolean;
    index?: number;
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
    session?: ISessionBase;
    getCurrentUserRoles(): NodeId[];
    checkPermission(node: BaseNode, action: PermissionType): boolean;
    isBrowseAccessRestricted(node: BaseNode): boolean;
    currentUserHasRole(role: NodeIdLike): boolean;
    isAccessRestricted(node: BaseNode): boolean;
    object?: UAObject | UAObjectType;
    currentTime?: PreciseClock;
    userIdentity?: string;
}
