import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRange } from "./dt_range";
import type { UABaseAnalog, UABaseAnalog_Base } from "./ua_base_analog";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogItemType i=2368                                       |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogItem_Base<T, DT extends DataType>  extends UABaseAnalog_Base<T, DT> {
    euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAAnalogItem<T, DT extends DataType> extends Omit<UABaseAnalog<T, DT>, "euRange">, UAAnalogItem_Base<T, DT> {}