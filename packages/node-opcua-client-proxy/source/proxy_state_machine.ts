/**
 * @module node-opcua-client-proxy
 */
import { EventEmitter } from "node:events";
import { assert } from "node-opcua-assert";
import type { NodeId } from "node-opcua-nodeid";
import type { UAProxyManager } from "./proxy_manager.js";

export class StateMachineProxy extends EventEmitter {
    public nodeId: NodeId;
    private proxyManager: UAProxyManager;

    constructor(proxyManager: UAProxyManager, nodeId: NodeId) {
        super();
        this.nodeId = nodeId;
        this.proxyManager = proxyManager;
        assert(this.proxyManager.session, "expecting valid session");
        Object.defineProperty(this, "proxyManager", {
            enumerable: false,
            writable: true
        });
    }
}
