// ----- this file has been automatically generated - do not edit
import { UAFlowMeasurementVariable, UAFlowMeasurementVariable_Base } from "./ua_flow_measurement_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |NormalizedVolumeFlowRateVariableType i=1135                 |
 * |dataType        |Float                                                       |
 * |dataType Name   |(number | number[]) i=10                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export type UANormalizedVolumeFlowRateVariable_Base<T extends (number | number[])> = UAFlowMeasurementVariable_Base<T>;
export interface UANormalizedVolumeFlowRateVariable<T extends (number | number[])> extends UAFlowMeasurementVariable<T>, UANormalizedVolumeFlowRateVariable_Base<T> {
}