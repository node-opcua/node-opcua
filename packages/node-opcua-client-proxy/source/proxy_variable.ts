/**
 * @module node-opcua-client-proxy
 */
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { ReferenceDescription } from "node-opcua-service-browse";
import { ProxyBaseNode } from "./proxy_base_node";
import type { UAProxyManager } from "./proxy_manager";

export class ProxyVariable extends ProxyBaseNode {
    constructor(proxyManager: UAProxyManager, nodeId: NodeId, _reference: ReferenceDescription) {
        super(proxyManager, nodeId, NodeClass.Variable);
    }
}
