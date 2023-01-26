// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/source/ua_transition_event"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { EnumPartQuality } from "./enum_part_quality"
import { EnumProcessIrregularity } from "./enum_process_irregularity"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionPartTransitionEventType ns=10;i=27   |
 * |isAbstract      |true                                              |
 */
export interface UAProductionPartTransitionEvent_Base extends UATransitionEvent_Base {
    customerOrderIdentifier?: UAProperty<UAString, DataType.String>;
    identifier?: UAProperty<UAString, DataType.String>;
    jobIdentifier: UAProperty<UAString, DataType.String>;
    name: UAProperty<UAString, DataType.String>;
    partQuality: UABaseDataVariable<EnumPartQuality, DataType.Int32>;
    processIrregularity: UABaseDataVariable<EnumProcessIrregularity, DataType.Int32>;
}
export interface UAProductionPartTransitionEvent extends UATransitionEvent, UAProductionPartTransitionEvent_Base {
}