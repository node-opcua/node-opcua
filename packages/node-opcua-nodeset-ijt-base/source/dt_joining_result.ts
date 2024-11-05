// ----- this file has been automatically generated - do not edit
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTResultValue } from "./dt_result_value"
import { DTStepResult } from "./dt_step_result"
import { DTErrorInformation } from "./dt_error_information"
import { DTJoiningTrace } from "./dt_joining_trace"
/**
 * This structure represents the data associated
 * with Joining Result and the corresponding
 * measurement values.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningResultDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningResult extends DTStructure {
  /** It provides the primary reason for failure. If a violation is handled by a rework step resulting in a successful operation, then it is not reported as failure.*/
  failureReason?: Byte; // Byte ns=0;i=3
  /** It is an array of overall result values which contains the measurement values of different quantities like torque, angle, time, etc. based on the program. 

Note: If the operation is terminated in the first step and no values are available to report, then this list may be empty.*/
  overallResultValues: DTResultValue[]; // ExtensionObject ns=18;i=3007
  /** It is an array of step results corresponding to each step in the program. This parameter is used if the system provides one or more step results.*/
  stepResults?: DTStepResult[]; // ExtensionObject ns=18;i=3009
  /** It is an array of external errors which captures the failures outside the boundary of the program are captured as part of the Errors. It is up to the application to fill in the critical/primary error in the Errors list as top entry.*/
  errors?: DTErrorInformation[]; // ExtensionObject ns=18;i=3006
  /** It is the identifier of the step result which is the primary cause of failure.*/
  failingStepResultId?: UAString; // String ns=0;i=31918
  /** It is a structure to include the Joining Trace content. This can be NULL or empty and it is up to the application to send this as part of the Joining Result.*/
  trace?: DTJoiningTrace; // ExtensionObject ns=18;i=3012
}
export interface UDTJoiningResult extends ExtensionObject, DTJoiningResult {};