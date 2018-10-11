// tslint:disable:no-shadowed-variable
import * as async from "async";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";

import {
    ClientSession,
    ClientSessionImpl,
    ClientSubscription, DataValue
} from "node-opcua-client";

import {
    ObjectTypeIds, ReferenceTypeIds
} from "node-opcua-constants";

import {
    AttributeIds,
    coerceAccessLevelFlag,
    NodeClass
} from "node-opcua-data-model";

import { coerceNodeId, makeNodeId, NodeId } from "node-opcua-nodeid";
import { BrowseResult } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "./common";
import { UAProxyManager } from "./proxy_manager";
import { ProxyObject } from "./proxy_object";

export function makeRefId(referenceTypeName: string): NodeId {

    const nodeId = makeNodeId((ReferenceTypeIds as any)[referenceTypeName]
        || (ObjectTypeIds as any)[referenceTypeName]);

    // istanbul ignore next
    if (nodeId.isEmpty()) {
        throw new Error("makeRefId: cannot find ReferenceTypeName + " + referenceTypeName);
    }
    return nodeId;
}

