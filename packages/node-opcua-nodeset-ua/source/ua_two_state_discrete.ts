// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UADiscreteItem, UADiscreteItem_Base } from "./ua_discrete_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TwoStateDiscreteType i=2373                                 |
 * |dataType        |Boolean                                                     |
 * |dataType Name   |(boolean | boolean[]) i=1                                   |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscrete_Base<T extends (boolean | boolean[])>  extends UADiscreteItem_Base<T, DataType.Boolean> {
    falseState: UAProperty<LocalizedText, DataType.LocalizedText>;
    trueState: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UATwoStateDiscrete<T extends (boolean | boolean[])> extends UADiscreteItem<T, DataType.Boolean>, UATwoStateDiscrete_Base<T> {
}