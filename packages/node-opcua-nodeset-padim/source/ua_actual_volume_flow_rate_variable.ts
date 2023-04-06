// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAFlowMeasurementVariable, UAFlowMeasurementVariable_Base } from "./ua_flow_measurement_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |20:ActualVolumeFlowRateVariableType ns=20;i=1134  |
 * |dataType        |Float                                             |
 * |dataType Name   |number ns=0;i=10                                  |
 * |isAbstract      |false                                             |
 */
export type UAActualVolumeFlowRateVariable_Base<T extends number> = UAFlowMeasurementVariable_Base<T>;
export interface UAActualVolumeFlowRateVariable<T extends number> extends UAFlowMeasurementVariable<T>, UAActualVolumeFlowRateVariable_Base<T> {
}