// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogItem, UAAnalogItem_Base } from "./ua_analog_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |AnalogUnitRangeType ns=0;i=17570                  |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAAnalogUnitRange_Base<T, DT extends DataType>  extends UAAnalogItem_Base<T/*g*/, DT> {
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UAAnalogUnitRange<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*m*/DT>, "engineeringUnits">, UAAnalogUnitRange_Base<T, DT /*A*/> {
}