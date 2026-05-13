import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UAStateVariable, UAStateVariable_Base } from "./ua_state_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TwoStateVariableType i=8995                                 |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateVariable_Base<T extends LocalizedText>  extends UAStateVariable_Base<T> {
    id: UAProperty<boolean, DataType.Boolean>;
    transitionTime?: UAProperty<Date, DataType.DateTime>;
    effectiveTransitionTime?: UAProperty<Date, DataType.DateTime>;
    trueState?: UAProperty<LocalizedText, DataType.LocalizedText>;
    falseState?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UATwoStateVariable<T extends LocalizedText> extends Omit<UAStateVariable<T>, "id">, UATwoStateVariable_Base<T> {}