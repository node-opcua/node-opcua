// ----- this file has been automatically generated - do not edit
import { UAFlowMeasurementVariable, UAFlowMeasurementVariable_Base } from "./ua_flow_measurement_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ActualVolumeFlowRateVariableType i=1134                     |
 * |dataType        |Float                                                       |
 * |dataType Name   |(number | number[]) i=10                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export type UAActualVolumeFlowRateVariable_Base<T extends (number | number[])> = UAFlowMeasurementVariable_Base<T>;
export interface UAActualVolumeFlowRateVariable<T extends (number | number[])> extends UAFlowMeasurementVariable<T>, UAActualVolumeFlowRateVariable_Base<T> {
}