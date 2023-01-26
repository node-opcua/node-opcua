// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTTraceContent } from "./dt_trace_content"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
/**
 * It is to describe of the trace samples for a
 * given program step.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:TraceContentType ns=14;i=2006                  |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTTraceContent ns=14;i=3014                       |
 * |isAbstract      |false                                             |
 */
export interface UATraceContent_Base<T extends DTTraceContent>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * $description
     * The optional Description is an additional text to
     * describe the trace samples.
     */
    "$description"?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * name
     * The optional Name is the user readable name for
     * the given trace.
     */
    name?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * sensorId
     * The optional SensorId is the system-wide unique
     * identifier of the sensor which has reported the
     * values. This will be useful for identifying the
     * sensor when the same set of samples are reported
     * by multiple sensors.
     */
    sensorId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * values
     * The mandatory Values is an array of trace
     * samples. The values correspond to the
     * PhysicalQuantity attribute of
     * JoiningDataVariableType.
     */
    values: UAJoiningDataVariable<number[], DataType.Double>;
}
export interface UATraceContent<T extends DTTraceContent> extends UABaseDataVariable<T, DataType.ExtensionObject>, UATraceContent_Base<T> {
}