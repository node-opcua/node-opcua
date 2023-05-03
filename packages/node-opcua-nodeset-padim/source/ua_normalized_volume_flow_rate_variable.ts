// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAFlowMeasurementVariable, UAFlowMeasurementVariable_Base } from "./ua_flow_measurement_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |NormalizedVolumeFlowRateVariableType i=1135                 |
 * |dataType        |Float                                                       |
 * |dataType Name   |number i=10                                                 |
 * |isAbstract      |false                                                       |
 */
export type UANormalizedVolumeFlowRateVariable_Base<T extends number> = UAFlowMeasurementVariable_Base<T>;
export interface UANormalizedVolumeFlowRateVariable<T extends number> extends UAFlowMeasurementVariable<T>, UANormalizedVolumeFlowRateVariable_Base<T> {
}