import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTNumberRange } from "./dt_number_range";
import type { UAAnalogUnitRange, UAAnalogUnitRange_Base } from "./ua_analog_unit_range";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalogNumberUnitRangeType i=23918                           |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogNumberUnitRange_Base<T, DT extends DataType>  extends UAAnalogUnitRange_Base<T, DT> {
    euNumberRange: UAProperty<DTNumberRange, DataType.ExtensionObject>;
}
export interface UAAnalogNumberUnitRange<T, DT extends DataType> extends Omit<UAAnalogUnitRange<T, DT>, "euNumberRange">, UAAnalogNumberUnitRange_Base<T, DT> {}