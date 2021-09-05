/**
 * @module node-opcua-client-proxy
 */
export class ProxyTransition {

    private _node: any;

    constructor(proxyNode: any) {
        Object.defineProperty(this, "_node", {value: proxyNode, enumerable: false});
    }

    get nodeId() {
        // note stateNumber has no real dataValue
        return this._node.nodeId.value.toString();
    }

    get browseName() {
        return this._node.browseName.toString();
    }

    get fromStateNode() {
        return this._node.$fromState;
    }

    get toStateNode() {
        return this._node.$toState;
    }
}
export function makeProxyTransition(node: any) {
    return new ProxyTransition(node);
}
