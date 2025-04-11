// ----- this file has been automatically generated - do not edit
import { UAAnalogSignal, UAAnalogSignal_Base } from "./ua_analog_signal"
import { UAPatMeasurementVariable } from "./ua_pat_measurement_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalyticalSignalType i=1065                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalyticalSignal_Base extends UAAnalogSignal_Base {
    analogSignal: UAPatMeasurementVariable<number>;
}
export interface UAAnalyticalSignal extends Omit<UAAnalogSignal, "analogSignal">, UAAnalyticalSignal_Base {
}