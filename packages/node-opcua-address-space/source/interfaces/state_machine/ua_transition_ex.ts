import { UAObject, UAObjectType, UAVariable, BaseNode } from "node-opcua-address-space-base";
import { UAState, UATransition, UATransition_Base } from "node-opcua-nodeset-ua";

export interface UATransitionEx extends UATransition {
    get toStateNode(): BaseNode | null;
    get fromStateNode(): BaseNode | null;
}
