// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAStateVariable, UAStateVariable_Base } from "./ua_state_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |TwoStateVariableType ns=0;i=8995                  |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UATwoStateVariable_Base<T extends LocalizedText/*j*/>  extends UAStateVariable_Base<T/*h*/> {
    id: UAProperty<boolean, /*z*/DataType.Boolean>;
    transitionTime?: UAProperty<Date, /*z*/DataType.DateTime>;
    effectiveTransitionTime?: UAProperty<Date, /*z*/DataType.DateTime>;
    trueState?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    falseState?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UATwoStateVariable<T extends LocalizedText/*j*/> extends Omit<UAStateVariable<T/*k*/>, "id">, UATwoStateVariable_Base<T /*B*/> {
}