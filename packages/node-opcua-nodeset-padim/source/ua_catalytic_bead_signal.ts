// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UACatalyticBeadSignal_signalConditionSet extends UAObject { // Object
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
      sensorNextCalibrationFixed?: UAProperty<number, DataType.Float>;
      sensorNextCalibrationDynamic?: UAProperty<number, DataType.Float>;
      powerOnDurationSensor?: UAProperty<number, DataType.Double>;
      sensingElementResidualLife?: UAProperty<number, DataType.Float>;
      relativeGasFlowRate?: UAProperty<number, DataType.Float>;
      sensorValue?: UAAnalogUnit<number, DataType.Float>;
      sensingElementResidualSensitivity?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CatalyticBeadSignalType i=1232                              |
 * |isAbstract      |false                                                       |
 */
export interface UACatalyticBeadSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UACatalyticBeadSignal_signalConditionSet;
}
export interface UACatalyticBeadSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UACatalyticBeadSignal_Base {
}