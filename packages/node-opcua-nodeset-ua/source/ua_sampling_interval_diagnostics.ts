// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSamplingIntervalDiagnostics } from "./dt_sampling_interval_diagnostics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SamplingIntervalDiagnosticsType ns=0;i=2165       |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSamplingIntervalDiagnostics ns=0;i=856          |
 * |isAbstract      |false                                             |
 */
export interface UASamplingIntervalDiagnostics_Base<T extends DTSamplingIntervalDiagnostics/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    samplingInterval: UABaseDataVariable<number, /*z*/DataType.Double>;
    sampledMonitoredItemsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    maxSampledMonitoredItemsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    disabledMonitoredItemsSamplingCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UASamplingIntervalDiagnostics<T extends DTSamplingIntervalDiagnostics/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASamplingIntervalDiagnostics_Base<T /*B*/> {
}