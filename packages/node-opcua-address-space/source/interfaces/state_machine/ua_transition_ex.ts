import { BaseNode } from "node-opcua-address-space-base";
import { UATransition } from "node-opcua-nodeset-ua";

export interface UATransitionEx extends UATransition {
    get toStateNode(): BaseNode | null;
    get fromStateNode(): BaseNode | null;
}
