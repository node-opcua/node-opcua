// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTStepResult } from "./dt_step_result"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { DTResultValue } from "./dt_result_value"
/**
 * It is used report measurement values
 * corresponding to a given step in the program.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:StepResultType ns=14;i=2004                    |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTStepResult ns=14;i=3009                         |
 * |isAbstract      |false                                             |
 */
export interface UAStepResult_Base<T extends DTStepResult>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * name
     * The optional Name is the user readable name of
     * the given step. This can be the name of the step
     * in the configuration for ease of use and
     * troubleshooting.
     */
    name?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * programStep
     * The optional ProgramStep is the step number or
     * name of the program step. Sometimes the step id
     * is like 2A, 3B based on number of branches. Hence
     * a string place holder is needed instead of number.
     */
    programStep?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * programStepId
     * The optional ProgramStepId is the system-wide
     * unique identifier of the Program Step.
     */
    programStepId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * resultEvalution
     * The optional ResultEvaluation indicates if the
     * StepResult is successful or not.
     */
    resultEvalution?: UABaseDataVariable<EnumResultEvaluation, DataType.Int32>;
    /**
     * startTimeOffset
     * The optional StartTimeOffset (in seconds) is the
     * offset to the ProcessingTimes.StartTime in
     * Result, this value can be used to order the steps
     * in execution order if same step is run multiple
     * times.
     */
    startTimeOffset?: UABaseDataVariable<number, DataType.Double>;
    /**
     * stepResultId
     * The mandatory StepResultId is the system-wide
     * unique identifier of the step result.
     */
    stepResultId: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * stepResultValues
     * The optional StepResultValues is the set of
     * values which needs to be measured as per the
     * program step.
     */
    stepResultValues?: UABaseDataVariable<DTResultValue[], DataType.ExtensionObject>;
    /**
     * stepTraceId
     * The optional StepTraceId is  the system-wide
     * unique identifier of the StepTrace associated to
     * the StepResult.
     */
    stepTraceId?: UABaseDataVariable<Guid, DataType.Guid>;
}
export interface UAStepResult<T extends DTStepResult> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAStepResult_Base<T> {
}