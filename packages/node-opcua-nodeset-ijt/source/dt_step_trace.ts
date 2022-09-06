// ----- this file has been automatically generated - do not edit
import { UInt32, Guid } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTTraceContent } from "./dt_trace_content"
/**
 * It is to describe of the trace for a given
 * program step.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:StepTraceDataType                              |
 * | isAbstract|false                                             |
 */
export interface DTStepTrace extends DTStructure {
/** The mandatory StepTraceId is the system-wide unique identifier of the step trace.*/
  stepTraceId: Guid; // Guid ns=0;i=14
/** The mandatory StepResultId is the system-wide unique identifier of the associated step result.*/
  stepResultId: Guid; // Guid ns=0;i=14
/** The mandatory NumberOfTracePoints is the total number of trace points to be sent for each quantity.*/
  numberOfTracePoints: UInt32; // UInt32 ns=0;i=7
/** The optional SamplingInterval (in seconds) is the time between each sample in the given Trace array. This is required if applications want to reduce the amount of data by omitting the TraceData array which represents TIME.*/
  samplingInterval: number; // Double ns=0;i=11
/** The optional StartTimeOffset is the offset to the ProcessingTimes.StartTime in the Result instance. This value can be used to order the steps in execution order if same step is run multiple times.*/
  startTimeOffset: number; // Double ns=0;i=11
/** The mandatory StepTraceContent is an array of trace data which contains the samples of different quantities like torque, angle, time, etc. The array size of TraceContent array should be same for each quantity and that is determined by the NumberOfTracePoints value.*/
  stepTraceContent: DTTraceContent[]; // ExtensionObject ns=14;i=3014
}