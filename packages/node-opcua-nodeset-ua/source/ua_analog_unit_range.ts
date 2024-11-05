// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogItem, UAAnalogItem_Base } from "./ua_analog_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogUnitRangeType i=17570                                 |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogUnitRange_Base<T, DT extends DataType>  extends UAAnalogItem_Base<T, DT> {
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UAAnalogUnitRange<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits">, UAAnalogUnitRange_Base<T, DT> {
}