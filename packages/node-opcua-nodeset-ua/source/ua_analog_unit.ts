// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |AnalogUnitType ns=0;i=17497                       |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAAnalogUnit_Base<T, DT extends DataType>  extends UABaseAnalog_Base<T/*g*/, DT> {
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UAAnalogUnit<T, DT extends DataType> extends Omit<UABaseAnalog<T, /*m*/DT>, "engineeringUnits">, UAAnalogUnit_Base<T, DT /*A*/> {
}