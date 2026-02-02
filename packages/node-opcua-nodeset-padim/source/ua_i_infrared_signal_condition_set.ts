// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IInfraredSignalConditionSetType i=1229                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIInfraredSignalConditionSet_Base extends UABaseInterface_Base {
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    sourceResidualLife?: UAProperty<number, DataType.Float>;
    transmissionRatio?: UAProperty<number, DataType.Float>;
    sensorNextCalibrationFixed?: UAProperty<number, DataType.Float>;
    sensorNextCalibrationDynamic?: UAProperty<number, DataType.Float>;
    powerOnDurationSensor?: UAProperty<number, DataType.Double>;
    sensingElementResidualLife?: UAProperty<number, DataType.Float>;
    relativeGasFlowRate?: UAProperty<number, DataType.Float>;
    sensingElementResidualSensitivity?: UAProperty<number, DataType.Float>;
}
export interface UAIInfraredSignalConditionSet extends UABaseInterface, UAIInfraredSignalConditionSet_Base {
}