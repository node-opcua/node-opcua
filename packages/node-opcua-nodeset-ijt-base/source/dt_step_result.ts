// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { EnumResultEvaluationEnum } from "node-opcua-nodeset-machinery-result/dist/enum_result_evaluation_enum"
import { DTResultValue } from "./dt_result_value"
/**
 * This structure represents the measurement values
 * corresponding to a given step in the program. It
 * is used in JoiningResultDataType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |StepResultDataType                                          |
 * | isAbstract|false                                                       |
 */
export interface DTStepResult extends DTStructure {
  /** It is the system-wide unique identifier of the step result.*/
  stepResultId: UAString; // String ns=0;i=31918
  /** It is the system-wide unique identifier of the Program Step.*/
  programStepId?: UAString; // String ns=0;i=31918
  /** It is the step number or name of the program step. Sometimes the step id is like 2A, 3B based on number of branches. Hence a string place holder is needed instead of number.*/
  programStep?: UAString; // String ns=0;i=12
  /** It is the user-friendly name of the given step. This can be the name of the step in the configuration for ease of use and troubleshooting.*/
  name?: UAString; // String ns=0;i=12
  /** It indicates if the StepResult is successful or not.*/
  resultEvaluation?: EnumResultEvaluationEnum; // Int32 ns=11;i=3002
  /** It is the offset to the ProcessingTimes.StartTime in Result, this value can be used to order the steps in execution order if same step is run multiple times.*/
  startTimeOffset?: number; // Double ns=0;i=290
  /** It is the system-wide unique identifier of the StepTrace associated to the StepResult.*/
  stepTraceId?: UAString; // String ns=0;i=31918
  /** It is the set of values which needs to be measured as per the program step.*/
  stepResultValues?: DTResultValue[]; // ExtensionObject ns=18;i=3007
}
export interface UDTStepResult extends ExtensionObject, DTStepResult {};