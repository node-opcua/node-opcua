import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/dist/ua_transition_event";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionProgramTransitionEventType i=17                   |
 * |isAbstract      |true                                                        |
 */
export interface UAProductionProgramTransitionEvent_Base extends UATransitionEvent_Base {
    jobIdentifier: UAProperty<UAString, DataType.String>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UAProductionProgramTransitionEvent extends UATransitionEvent, UAProductionProgramTransitionEvent_Base {}