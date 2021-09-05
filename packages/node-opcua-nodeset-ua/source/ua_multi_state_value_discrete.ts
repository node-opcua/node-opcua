// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { DTEnumValue } from "./dt_enum_value"
import { UADiscreteItem, UADiscreteItem_Base } from "./ua_discrete_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |MultiStateValueDiscreteType ns=0;i=11238          |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAMultiStateValueDiscrete_Base<T, DT extends DataType>  extends UADiscreteItem_Base<T/*g*/, DT> {
    enumValues: UAProperty<DTEnumValue[], /*z*/DataType.ExtensionObject>;
    valueAsText: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UAMultiStateValueDiscrete<T, DT extends DataType> extends UADiscreteItem<T, /*m*/DT>, UAMultiStateValueDiscrete_Base<T, DT /*A*/> {
}