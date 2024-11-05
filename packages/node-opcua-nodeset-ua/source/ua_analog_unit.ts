// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogUnitType i=17497                                      |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogUnit_Base<T, DT extends DataType>  extends UABaseAnalog_Base<T, DT> {
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UAAnalogUnit<T, DT extends DataType> extends Omit<UABaseAnalog<T, DT>, "engineeringUnits">, UAAnalogUnit_Base<T, DT> {
}