import type { BaseNode } from "node-opcua-address-space-base";
import type { UATransition } from "node-opcua-nodeset-ua";

export interface UATransitionEx extends UATransition {
    get toStateNode(): BaseNode | null;
    get fromStateNode(): BaseNode | null;
}
