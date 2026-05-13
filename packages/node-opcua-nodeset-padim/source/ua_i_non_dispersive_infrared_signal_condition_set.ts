import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseAnalog } from "node-opcua-nodeset-ua/dist/ua_base_analog";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |INonDispersiveInfraredSignalConditionSetType i=1055         |
 * |isAbstract      |true                                                        |
 */
export interface UAINonDispersiveInfraredSignalConditionSet_Base extends UABaseInterface_Base {
    absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
    chopperFrequencyDeviation?: UABaseAnalog<number, DataType.Float>;
    sampleCellTemperature?: UAAnalogUnit<number, DataType.Float>;
    sourceResidualLife?: UAProperty<number, DataType.Float>;
}
export interface UAINonDispersiveInfraredSignalConditionSet extends UABaseInterface, UAINonDispersiveInfraredSignalConditionSet_Base {}