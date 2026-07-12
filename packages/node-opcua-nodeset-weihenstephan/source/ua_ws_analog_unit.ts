import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UAAnalogUnit, UAAnalogUnit_Base } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |WSAnalogUnitType i=2000                                     |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAWSAnalogUnit_Base<T, DT extends DataType>  extends UAAnalogUnit_Base<T, DT> {
    wsTagNumber?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAWSAnalogUnit<T, DT extends DataType> extends UAAnalogUnit<T, DT>, UAWSAnalogUnit_Base<T, DT> {}