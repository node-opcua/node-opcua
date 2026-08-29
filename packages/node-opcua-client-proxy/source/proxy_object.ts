/**
 * @module node-opcua-client-proxy
 */
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { ProxyBaseNode } from "./proxy_base_node.js";
import type { UAProxyManager } from "./proxy_manager.js";

export class ProxyObject extends ProxyBaseNode {
    constructor(proxyManager: UAProxyManager, nodeId: NodeId) {
        super(proxyManager, nodeId, NodeClass.Object);
    }
}
