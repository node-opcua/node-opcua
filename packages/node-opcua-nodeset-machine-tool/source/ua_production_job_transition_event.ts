// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/source/ua_transition_event"
export interface UAProductionJobTransitionEvent_runsPlanned<T, DT extends DataType> extends UABaseDataVariable<T, /*b*/DT> { // Variable
      isValid: UAProperty<boolean, /*z*/DataType.Boolean>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionJobTransitionEventType ns=10;i=31    |
 * |isAbstract      |true                                              |
 */
export interface UAProductionJobTransitionEvent_Base extends UATransitionEvent_Base {
    customerOrderIdentifier?: UAProperty<UAString, /*z*/DataType.String>;
    identifier: UAProperty<UAString, /*z*/DataType.String>;
    orderIdentifier?: UAProperty<UAString, /*z*/DataType.String>;
    runsCompleted: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    runsPlanned: UAProductionJobTransitionEvent_runsPlanned<UInt32, /*z*/DataType.UInt32>;
}
export interface UAProductionJobTransitionEvent extends UATransitionEvent, UAProductionJobTransitionEvent_Base {
}