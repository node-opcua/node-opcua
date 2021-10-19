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

export interface IContinuationPointInfo {
    continuationPoint?: ContinuationPoint;
}
export interface IContinuationPointInfo2 extends IContinuationPointInfo {
    dataValues?: DataValue[];
    continuationPoint?: ContinuationPoint;
    statusCode: StatusCode;
}

export interface ContinuationStuff {
    continuationPoint: ContinuationPoint | null;
    releaseContinuationPoints?: boolean;
    index?: number;
}
export interface IContinuationPointManager {
    //
    registerHistoryReadRaw(
        maxElements: number,
        dataValues: DataValue[],
        continuationData: ContinuationStuff
    ): IContinuationPointInfo2;
    getNextHistoryReadRaw(numValues: number, continuationData: ContinuationStuff): IContinuationPointInfo2;
    //
    register(maxElements: number, values: ReferenceDescription[]): IContinuationPointInfo;
    getNext(continuationPoint: ContinuationPoint): IContinuationPointInfo;
    cancel(continuationPoint: ContinuationPoint): IContinuationPointInfo;
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
