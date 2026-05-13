import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ICatalyticBeadSignalConditionSetType i=1231                 |
 * |isAbstract      |true                                                        |
 */
export interface UAICatalyticBeadSignalConditionSet_Base extends UABaseInterface_Base {
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    sensorNextCalibrationFixed?: UAProperty<number, DataType.Float>;
    sensorNextCalibrationDynamic?: UAProperty<number, DataType.Float>;
    powerOnDurationSensor?: UAProperty<number, DataType.Double>;
    sensingElementResidualLife?: UAProperty<number, DataType.Float>;
    relativeGasFlowRate?: UAProperty<number, DataType.Float>;
    sensorValue?: UAAnalogUnit<number, DataType.Float>;
    sensingElementResidualSensitivity?: UAProperty<number, DataType.Float>;
}
export interface UAICatalyticBeadSignalConditionSet extends UABaseInterface, UAICatalyticBeadSignalConditionSet_Base {}