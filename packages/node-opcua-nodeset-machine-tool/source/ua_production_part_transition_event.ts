// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/source/ua_transition_event"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionPartTransitionEventType ns=10;i=27   |
 * |isAbstract      |true                                              |
 */
export interface UAProductionPartTransitionEvent_Base extends UATransitionEvent_Base {
    customerOrderIdentifier?: UAProperty<UAString, /*z*/DataType.String>;
    identifier?: UAProperty<UAString, /*z*/DataType.String>;
    jobIdentifier: UAProperty<UAString, /*z*/DataType.String>;
    name: UAProperty<UAString, /*z*/DataType.String>;
    partQuality: UABaseDataVariable<any, any>;
    processIrregularity: UABaseDataVariable<any, any>;
}
export interface UAProductionPartTransitionEvent extends UATransitionEvent, UAProductionPartTransitionEvent_Base {
}