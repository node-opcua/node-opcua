import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog";

// ----- this file has been automatically generated - do not edit

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
export interface UAAnalogUnit<T, DT extends DataType> extends Omit<UABaseAnalog<T, DT>, "engineeringUnits">, UAAnalogUnit_Base<T, DT> {}