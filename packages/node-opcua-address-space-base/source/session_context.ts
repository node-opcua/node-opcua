import { Certificate } from "node-opcua-crypto";
import { DataValue } from "node-opcua-data-value";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { MessageSecurityMode, PermissionType, UserIdentityToken } from "node-opcua-types";

import { BaseNode } from "./base_node";
import { UAObject } from "./ua_object";
import { UAObjectType } from ".";

export interface IChannelBase {
    clientCertificate: Certificate | null;
    // clientNonce: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: string;
}

export interface ISessionBase {
    userIdentityToken?: UserIdentityToken;
    channel?: IChannelBase;
    getSessionId(): NodeId; // session NodeID
}
export interface ContinuationPointData {
    dataValues: DataValue[]
};
export interface ISessionContext {
    session?: ISessionBase;
    getCurrentUserRoles(): NodeId[];
    checkPermission(node: BaseNode, action: PermissionType): boolean;
    isBrowseAccessRestricted(node: BaseNode): boolean;
    currentUserHasRole(role: NodeIdLike): boolean;
    isAccessRestricted(node: BaseNode): boolean;
    object?: UAObject | UAObjectType;
    continuationPoints?: { [key:string]: ContinuationPointData|null};
    currentTime?: PreciseClock;
    userIdentity?: string;
}
