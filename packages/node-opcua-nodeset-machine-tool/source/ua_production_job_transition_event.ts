// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/dist/ua_transition_event"
export interface UAProductionJobTransitionEvent_runsPlanned<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      isValid: UAProperty<boolean, DataType.Boolean>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionJobTransitionEventType i=31                       |
 * |isAbstract      |true                                                        |
 */
export interface UAProductionJobTransitionEvent_Base extends UATransitionEvent_Base {
    customerOrderIdentifier?: UAProperty<UAString, DataType.String>;
    identifier: UAProperty<UAString, DataType.String>;
    orderIdentifier?: UAProperty<UAString, DataType.String>;
    runsCompleted: UABaseDataVariable<UInt32, DataType.UInt32>;
    runsPlanned: UAProductionJobTransitionEvent_runsPlanned<UInt32, DataType.UInt32>;
}
export interface UAProductionJobTransitionEvent extends UATransitionEvent, UAProductionJobTransitionEvent_Base {
}