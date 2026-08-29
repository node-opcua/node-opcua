import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTNumberRange } from "./dt_number_range.js";
import type { UAAnalogItem, UAAnalogItem_Base } from "./ua_analog_item.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogNumberItemType i=23906                                |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogNumberItem_Base<T, DT extends DataType>  extends UAAnalogItem_Base<T, DT> {
    euNumberRange: UAProperty<DTNumberRange, DataType.ExtensionObject>;
}
export interface UAAnalogNumberItem<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "euNumberRange">, UAAnalogNumberItem_Base<T, DT> {}