// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSamplingIntervalDiagnostics } from "./dt_sampling_interval_diagnostics"
import { UASamplingIntervalDiagnostics } from "./ua_sampling_interval_diagnostics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SamplingIntervalDiagnosticsArrayType ns=0;i=2164  |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSamplingIntervalDiagnostics[] ns=0;i=856        |
 * |isAbstract      |false                                             |
 */
export interface UASamplingIntervalDiagnosticsArray_Base<T extends DTSamplingIntervalDiagnostics[]/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    samplingIntervalDiagnostics: UASamplingIntervalDiagnostics<DTSamplingIntervalDiagnostics>;
}
export interface UASamplingIntervalDiagnosticsArray<T extends DTSamplingIntervalDiagnostics[]/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASamplingIntervalDiagnosticsArray_Base<T /*B*/> {
}