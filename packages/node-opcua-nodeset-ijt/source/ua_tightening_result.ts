// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Byte, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTResult } from "./dt_result"
import { DTErrorInformation } from "./dt_error_information"
import { DTResultValue } from "./dt_result_value"
import { DTStepResult } from "./dt_step_result"
import { DTTighteningTrace } from "./dt_tightening_trace"
/**
 * It is used report data associated with Tightening
 * Result and the corresponding measurement values.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:TighteningResultType ns=14;i=2007              |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTResult ns=14;i=3004                             |
 * |isAbstract      |false                                             |
 */
export interface UATighteningResult_Base<T extends DTResult>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * errors
     * The optional Errors is an array of external
     * errors which captures the failures outside the
     * boundary of the program are captured as part of
     * the Errors. It is up to the application to fill
     * in the critical/primary error in the Errors list
     * as top entry.
     */
    errors?: UABaseDataVariable<DTErrorInformation[], DataType.ExtensionObject>;
    /**
     * failingStepResultId
     * The optional FailingStepResultId is the
     * identifier of the step result which is the
     * primary cause of failure.
     */
    failingStepResultId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * failureReason
     * The optional FailureReason is an enumeration
     * which provides the primary reason for failure. If
     * a violation is handled by a rework step resulting
     * in a successful operation, then it is not
     * reported as failure.
     */
    failureReason?: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * jointId
     * The optional JointId is the system-wide unique
     * identifier of the Joint corresponding to this
     * result.
     */
    jointId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * overallResultValues
     * The mandatory OverallResultValues is an array of
     * overall result values which contains the
     * measurement values of different quantities like
     * torque, angle, time, etc. based on the program.
     */
    overallResultValues: UABaseDataVariable<DTResultValue[], DataType.ExtensionObject>;
    /**
     * programId
     * The optional ProgramId the system-wide unique
     * Identifier of the Program configured for
     * generating this result.
     */
    programId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * programVersionId
     * The optional ProgramVersionId is the system-wide
     * unique version identifier of the Program
     * configured for generating this result. This will
     * be unique for every change/update of the given
     * program.
     */
    programVersionId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * stepResults
     * The optional StepResults is an array of step
     * results corresponding to each step in the
     * program. This parameter is used if the system
     * provides one or more step results.
     */
    stepResults?: UABaseDataVariable<DTStepResult[], DataType.ExtensionObject>;
    /**
     * trace
     * The optional Trace is a structure to include the
     * TighteningTrace content. This can be NULL or
     * empty and it is up to the application to send
     * this as part of the Tightening Result.
     */
    trace?: UABaseDataVariable<DTTighteningTrace, DataType.ExtensionObject>;
}
export interface UATighteningResult<T extends DTResult> extends UABaseDataVariable<T, DataType.ExtensionObject>, UATighteningResult_Base<T> {
}