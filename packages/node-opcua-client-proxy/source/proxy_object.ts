/**
 * @module node-opcua-client-proxy
 */
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { ProxyBaseNode } from "./proxy_base_node";
import { UAProxyManager } from "./proxy_manager";

export class ProxyObject extends ProxyBaseNode {
    constructor(proxyManager: UAProxyManager, nodeId: NodeId) {
        super(proxyManager, nodeId, NodeClass.Object);
    }
}
