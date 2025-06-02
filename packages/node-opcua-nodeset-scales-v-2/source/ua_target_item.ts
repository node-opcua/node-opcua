// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogItem, UAAnalogItem_Base } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TargetItemType i=51                                         |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATargetItem_Base<T, DT extends DataType>  extends UAAnalogItem_Base<T, DT> {
    allowedEngineeringUnits?: UAProperty<EUInformation[], DataType.ExtensionObject>;
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
    minusTolerance?: UAAnalogUnit<any, any>;
    plusTolerance?: UAAnalogUnit<any, any>;
}
export interface UATargetItem<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits">, UATargetItem_Base<T, DT> {
}