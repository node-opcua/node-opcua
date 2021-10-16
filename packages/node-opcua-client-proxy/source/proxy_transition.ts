import { QualifiedName } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";

export interface ProxyNode {
    nodeId: NodeId;
    browseName: QualifiedName;
    $fromState: ProxyNode;
    $toState: ProxyNode;
    $components: ProxyNode[];
    typeDefinition?: { toString(): string };
}
/**
 * @module node-opcua-client-proxy
 */
export class ProxyTransition {
    private _node: ProxyNode;

    constructor(proxyNode: ProxyNode) {
        this._node = proxyNode;
    }

    get nodeId(): string {
        // note stateNumber has no real dataValue
        return this._node.nodeId.value.toString();
    }

    get browseName(): string {
        return this._node.browseName.toString();
    }

    get fromStateNode(): ProxyNode {
        return this._node.$fromState;
    }

    get toStateNode(): ProxyNode {
        return this._node.$toState;
    }
}
export function makeProxyTransition(node: ProxyNode): ProxyTransition {
    return new ProxyTransition(node);
}
