// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UADiscreteItem, UADiscreteItem_Base } from "./ua_discrete_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |TwoStateDiscreteType ns=0;i=2373                  |
 * |dataType        |Boolean                                           |
 * |dataType Name   |boolean ns=0;i=1                                  |
 * |isAbstract      |false                                             |
 */
export interface UATwoStateDiscrete_Base<T extends boolean>  extends UADiscreteItem_Base<T, DataType.Boolean> {
    falseState: UAProperty<LocalizedText, DataType.LocalizedText>;
    trueState: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UATwoStateDiscrete<T extends boolean> extends UADiscreteItem<T, DataType.Boolean>, UATwoStateDiscrete_Base<T> {
}