// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAProcessValue } from "node-opcua-nodeset-machinery-process-values/dist/ua_process_value"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CyclicEventType i=1016                                      |
 * |isAbstract      |true                                                        |
 */
export interface UACyclicEvent_Base extends UABaseEvent_Base {
    currentProcessValue: UAProcessValue;
    cycleCount: UABaseDataVariable<UInt32, DataType.UInt32>;
    partId?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UACyclicEvent extends UABaseEvent, UACyclicEvent_Base {
}