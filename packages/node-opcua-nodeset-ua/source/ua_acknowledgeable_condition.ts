// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UACondition, UACondition_Base } from "./ua_condition"
import { UATwoStateVariable } from "./ua_two_state_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AcknowledgeableConditionType ns=0;i=2881          |
 * |isAbstract      |false                                             |
 */
export interface UAAcknowledgeableCondition_Base extends UACondition_Base {
    enabledState: UATwoStateVariable<LocalizedText>;
    ackedState: UATwoStateVariable<LocalizedText>;
    confirmedState?: UATwoStateVariable<LocalizedText>;
    acknowledge: UAMethod;
    confirm?: UAMethod;
}
export interface UAAcknowledgeableCondition extends Omit<UACondition, "enabledState">, UAAcknowledgeableCondition_Base {
}