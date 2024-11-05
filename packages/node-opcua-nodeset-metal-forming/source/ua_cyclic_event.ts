// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAProcessValue } from "node-opcua-nodeset-machinery-process-values/source/ua_process_value"
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