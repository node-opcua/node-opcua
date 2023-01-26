// ----- this file has been automatically generated - do not edit
import { Byte, Guid } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTResultValue } from "./dt_result_value"
import { DTStepResult } from "./dt_step_result"
import { DTErrorInformation } from "./dt_error_information"
import { DTTighteningTrace } from "./dt_tightening_trace"
/**
 * It is used report data associated with Tightening
 * Result and the corresponding measurement values.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:TighteningResultDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTTighteningResult extends DTStructure {
  /** The optional ProgramId the system-wide unique Identifier of the Program configured for generating this result.*/
  programId?: Guid; // Guid ns=0;i=14
  /** The optional ProgramVersionId is the system-wide unique version identifier of the Program configured for generating this result. This will be unique for every change/update of the given program.*/
  programVersionId?: Guid; // Guid ns=0;i=14
  /** The optional FailureReason is an enumeration which provides the primary reason for failure. If a violation is handled by a rework step resulting in a successful operation, then it is not reported as failure.*/
  failureReason?: Byte; // Byte ns=0;i=3
  /** The mandatory OverallResultValues is an array of overall result values which contains the measurement values of different quantities like torque, angle, time, etc. based on the program.*/
  overallResultValues: DTResultValue[]; // ExtensionObject ns=14;i=3007
  /** The optional StepResults is an array of step results corresponding to each step in the program. This parameter is used if the system provides one or more step results.*/
  stepResults?: DTStepResult[]; // ExtensionObject ns=14;i=3009
  /** The optional Errors is an array of external errors which captures the failures outside the boundary of the program are captured as part of the Errors. It is up to the application to fill in the critical/primary error in the Errors list as top entry.*/
  errors?: DTErrorInformation[]; // ExtensionObject ns=14;i=3006
  /** The optional FailingStepResultId is the identifier of the step result which is the primary cause of failure.*/
  failingStepResultId?: Guid; // Guid ns=0;i=14
  /** The optional JointId is the system-wide unique identifier of the Joint corresponding to this result.*/
  jointId?: Guid; // Guid ns=0;i=14
  /** The optional Trace is a structure to include the TighteningTrace content. This can be NULL or empty and it is up to the application to send this as part of the Tightening Result.*/
  trace?: DTTighteningTrace; // ExtensionObject ns=14;i=3012
}
export interface UDTTighteningResult extends ExtensionObject, DTTighteningResult {};