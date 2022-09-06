// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTStepTrace } from "./dt_step_trace"
import { DTTraceContent } from "./dt_trace_content"
/**
 * It is to describe of the trace for a given
 * program step.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:StepTraceType ns=14;i=2005                     |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTStepTrace ns=14;i=3013                          |
 * |isAbstract      |false                                             |
 */
export interface UAStepTrace_Base<T extends DTStepTrace>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * numberOfTracePoints
     * The mandatory NumberOfTracePoints is the total
     * number of trace points to be sent for each
     * quantity.
     */
    numberOfTracePoints: UABaseDataVariable<UInt32, DataType.UInt32>;
    /**
     * samplingInterval
     * The optional SamplingInterval (in seconds) is the
     * time between each sample in the given Trace
     * array. This is required if applications want to
     * reduce the amount of data by omitting the
     * TraceContent array which represents TIME.
     */
    samplingInterval?: UABaseDataVariable<number, DataType.Double>;
    /**
     * startTimeOffset
     * The optional StartTimeOffset is the offset to the
     * ProcessingTimes.StartTime in the Result instance.
     * This value can be used to order the steps in
     * execution order if same step is run multiple
     * times.
     */
    startTimeOffset?: UABaseDataVariable<number, DataType.Double>;
    /**
     * stepResultId
     * The mandatory StepResultId is the system-wide
     * unique identifier of the associated step result.
     */
    stepResultId: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * stepTraceContent
     * The mandatory StepTraceContent is an array of
     * trace content which contains the samples of
     * different quantities like torque, angle, time,
     * etc. The array size of TraceContent should be
     * same for each quantity and that is determined by
     * the NumberOfTracePoints value.
     */
    stepTraceContent: UABaseDataVariable<DTTraceContent[], DataType.ExtensionObject>;
    /**
     * stepTraceId
     * The mandatory StepTraceId is the system-wide
     * unique identifier of the step trace.
     */
    stepTraceId: UABaseDataVariable<Guid, DataType.Guid>;
}
export interface UAStepTrace<T extends DTStepTrace> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAStepTrace_Base<T> {
}