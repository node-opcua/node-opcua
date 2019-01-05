/**
 * @module node-opcua-client-proxy
 */
import { NodeId } from "node-opcua-nodeid";

export class ProxyState {

    private _node: any;

    constructor(proxyNode: any) {
        Object.defineProperty(this, "_node", { value: proxyNode, enumerable: false });
    }

    public get browseName() {
        return this._node.browseName.toString();
    }

    public get stateNumber() {
        // note stateNumber has no real dataValue
        return this._node.stateNumber.nodeId.value.toString();
    }

    public get nodeId(): NodeId {
        // note stateNumber has no real dataValue
        return this._node.nodeId;
    }

    public toString() {

        return "state " + this.browseName + " stateNumber :" + this.stateNumber.toString();
    }
}

export function makeProxyState(node: any) {
    return new ProxyState(node);
}
