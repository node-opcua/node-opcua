import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |EnterStepSequenceEventType i=1027                           |
 * |isAbstract      |false                                                       |
 */
export interface UAEnterStepSequenceEvent_Base extends UABaseEvent_Base {
    steps: UAProperty<Int32, DataType.Int32>;
}
export interface UAEnterStepSequenceEvent extends UABaseEvent, UAEnterStepSequenceEvent_Base {}