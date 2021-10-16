/**
 * @module node-opcua-client-proxy
 */
import { NodeId } from "node-opcua-nodeid";
import { ProxyNode } from "./proxy_transition";

export class ProxyState {
    private _node: any;

    constructor(proxyNode: ProxyNode) {
        this._node = proxyNode;
    }

    public get browseName(): string {
        return this._node.browseName.toString();
    }

    public get stateNumber(): string {
        // note stateNumber has no real dataValue
        return this._node.stateNumber.nodeId.value.toString();
    }

    public get nodeId(): NodeId {
        // note stateNumber has no real dataValue
        return this._node.nodeId;
    }

    public toString(): string {
        return "state " + this.browseName + " stateNumber :" + this.stateNumber.toString();
    }
}

export function makeProxyState(node: ProxyNode): ProxyState {
    return new ProxyState(node);
}
