// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAInfraredSignal_signalConditionSet extends UAObject { // Object
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
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InfraredSignalType i=1230                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAInfraredSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UAInfraredSignal_signalConditionSet;
}
export interface UAInfraredSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UAInfraredSignal_Base {
}