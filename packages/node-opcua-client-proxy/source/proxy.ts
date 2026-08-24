/**
 * @module node-opcua-client-proxy
 */
import { ObjectTypeIds, ReferenceTypeIds } from "node-opcua-constants";
import { makeNodeId, type NodeId } from "node-opcua-nodeid";

export function makeRefId(referenceTypeName: string): NodeId {
    const nodeId = makeNodeId((ReferenceTypeIds as any)[referenceTypeName] || (ObjectTypeIds as any)[referenceTypeName]);

    // c8 ignore next
    if (nodeId.isEmpty()) {
        throw new Error(`makeRefId: cannot find ReferenceTypeName + ${referenceTypeName}`);
    }
    return nodeId;
}
