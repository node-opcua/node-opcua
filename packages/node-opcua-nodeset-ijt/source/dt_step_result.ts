// ----- this file has been automatically generated - do not edit
import { UAString, Guid } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { DTResultValue } from "./dt_result_value"
/**
 * It is used report measurement values
 * corresponding to a given step in the program.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:StepResultDataType                             |
 * | isAbstract|false                                             |
 */
export interface DTStepResult extends DTStructure {
  /** The mandatory StepResultId is the system-wide unique identifier of the step result.*/
  stepResultId: Guid; // Guid ns=0;i=14
  /** The optional ProgramStepId is the system-wide unique identifier of the Program Step.*/
  programStepId?: Guid; // Guid ns=0;i=14
  /** The optional ProgramStep is the step number or name of the program step. Sometimes the step id is like 2A, 3B based on number of branches. Hence a string place holder is needed instead of number.*/
  programStep?: UAString; // String ns=0;i=12
  /** The optional Name is the user readable name of the given step. This can be the name of the step in the configuration for ease of use and troubleshooting.*/
  name?: UAString; // String ns=0;i=12
  /** The optional ResultEvaluation indicates if the StepResult is successful or not.*/
  resultEvaluation?: EnumResultEvaluation; // Int32 ns=14;i=3008
  /** The optional StartTimeOffset (in seconds) is the offset to the ProcessingTimes.StartTime in Result, this value can be used to order the steps in execution order if same step is run multiple times.*/
  startTimeOffset?: number; // Double ns=0;i=11
  /** The optional StepTraceId is the system-wide unique identifier of the StepTrace associated to the StepResult.*/
  stepTraceId?: Guid; // Guid ns=0;i=14
  /** The optional StepResultValues is the set of values which needs to be measured as per the program step.*/
  stepResultValues?: DTResultValue[]; // ExtensionObject ns=14;i=3007
}
export interface UDTStepResult extends ExtensionObject, DTStepResult {};