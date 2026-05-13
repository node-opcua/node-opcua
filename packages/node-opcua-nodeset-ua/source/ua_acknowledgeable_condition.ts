import type { UAMethod } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";

import type { UACondition, UACondition_Base } from "./ua_condition";
import type { UATwoStateVariable } from "./ua_two_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AcknowledgeableConditionType i=2881                         |
 * |isAbstract      |false                                                       |
 */
export interface UAAcknowledgeableCondition_Base extends UACondition_Base {
    enabledState: UATwoStateVariable<LocalizedText>;
    ackedState: UATwoStateVariable<LocalizedText>;
    confirmedState?: UATwoStateVariable<LocalizedText>;
    acknowledge: UAMethod;
    confirm?: UAMethod;
}
export interface UAAcknowledgeableCondition extends Omit<UACondition, "enabledState">, UAAcknowledgeableCondition_Base {}