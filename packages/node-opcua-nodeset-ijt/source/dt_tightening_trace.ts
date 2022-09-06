// ----- this file has been automatically generated - do not edit
import { Guid } from "node-opcua-basic-types"
import { DTTrace } from "./dt_trace"
import { DTStepTrace } from "./dt_step_trace"
/**
 * This structure contains the aggregated
 * information of the Tightening Trace which is used
 * in TighteningResultDataType and which is
 * represented as TighteningTraceType variable.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:TighteningTraceDataType                        |
 * | isAbstract|false                                             |
 */
export interface DTTighteningTrace extends DTTrace {
/** The mandatory TraceId is the system-wide unique identifier of the Trace.*/
  traceId: Guid; // Guid ns=0;i=14
/** The mandatory ResultId is the system-wide unique identifier of the associated result. This is useful to link Result and Trace instances when the Result and Trace are sent separately.*/
  resultId: Guid; // Guid ns=0;i=14
/** The mandatory StepTraces is an array of StepTraceType which provides trace content for each step in the given program.*/
  stepTraces: DTStepTrace[]; // ExtensionObject ns=14;i=3013
}