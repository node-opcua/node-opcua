// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/source/ua_transition_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionProgramTransitionEventType ns=10;i=17|
 * |isAbstract      |true                                              |
 */
export interface UAProductionProgramTransitionEvent_Base extends UATransitionEvent_Base {
    jobIdentifier: UAProperty<UAString, /*z*/DataType.String>;
    name: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAProductionProgramTransitionEvent extends UATransitionEvent, UAProductionProgramTransitionEvent_Base {
}