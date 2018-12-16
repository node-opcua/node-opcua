/**
 * @module node-opcua-client-proxy
 */
// tslint:disable:no-shadowed-variable
import { EventEmitter } from "events";

import {
    ObjectTypeIds, ReferenceTypeIds
} from "node-opcua-constants";

import { makeNodeId, NodeId } from "node-opcua-nodeid";
import { BrowseResult } from "node-opcua-service-browse";

export function makeRefId(referenceTypeName: string): NodeId {

    const nodeId = makeNodeId((ReferenceTypeIds as any)[referenceTypeName]
        || (ObjectTypeIds as any)[referenceTypeName]);

    // istanbul ignore next
    if (nodeId.isEmpty()) {
        throw new Error("makeRefId: cannot find ReferenceTypeName + " + referenceTypeName);
    }
    return nodeId;
}
