/**
 * @module node-opcua-client-proxy
 */
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { ReferenceDescription } from "node-opcua-service-browse";
import { ProxyBaseNode } from "./proxy_base_node";
import { UAProxyManager } from "./proxy_manager";

export class ProxyVariable extends ProxyBaseNode {
    constructor(proxyManager: UAProxyManager, nodeId: NodeId, reference: ReferenceDescription) {
        super(proxyManager, nodeId, NodeClass.Variable);
    }
}
