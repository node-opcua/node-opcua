// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTTrace } from "./dt_trace"
import { DTStepTrace } from "./dt_step_trace"
/**
 * This structure is to describe the content of
 * traces for all the steps in the given program. It
 * is used in JoiningResultDataType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningTraceDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningTrace extends DTTrace {
  /** It is the system-wide unique identifier of the Trace.*/
  traceId: UAString; // String ns=0;i=31918
  /** It is the system-wide unique identifier of the associated result. This is useful to link Result and Trace instances when the Result and Trace are sent separately.*/
  resultId: UAString; // String ns=0;i=31918
  /** It is an array of StepTraceDataType which provides trace content for each step in the given result.*/
  stepTraces: DTStepTrace[]; // ExtensionObject ns=18;i=3013
}
export interface UDTJoiningTrace extends ExtensionObject, DTJoiningTrace {};