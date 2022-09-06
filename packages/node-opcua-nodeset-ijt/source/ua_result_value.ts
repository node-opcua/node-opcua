// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32, Byte, UAString, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTResultValue } from "./dt_result_value"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { UAJoiningDataVariable } from "./ua_joining_data_variable"
/**
 * It is used to report measurement values of the
 * joining operation. Those are meant to
 * characterize the quality of the process.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:ResultValueType ns=14;i=2003                   |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTResultValue ns=14;i=3007                        |
 * |isAbstract      |false                                             |
 */
export interface UAResultValue_Base<T extends DTResultValue>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * highLimit
     * The optional HighLimit provides the upper limit
     * of the measured value as per the program.
     */
    highLimit?: UABaseDataVariable<number, DataType.Double>;
    /**
     * lowLimit
     * The optional LowLimit provides the lower limit of
     * the measured value as per the program.
     */
    lowLimit?: UABaseDataVariable<number, DataType.Double>;
    /**
     * name
     * The optional Name is a user readable name of the
     * given measurement value.
     */
    name?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * reporterId
     * The optional ReporterId is the system-wide unique
     * identifier of the parameter configured in the
     * Tightening Program which is being monitored or
     * sampled.
     */
    reporterId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * resultEvaluation
     * The optional ResultEvaluation indicates whether
     * the measured value is as per the configured
     * limits and corresponds to a successful result or
     * not.
     */
    resultEvaluation?: UABaseDataVariable<EnumResultEvaluation, DataType.Int32>;
    /**
     * resultStep
     * The optional ResultStep provides the step number
     * or name of the program step which has generated
     * the result.
     */
    resultStep?: UABaseDataVariable<UAString, DataType.String>;
    /**
     * sensorId
     * The optional SensorId is the system-wide unique
     * identifier of the sensor which has reported the
     * value.
     */
    sensorId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * targetValue
     * The optional TargetValue provides the target
     * value of the specific measurement in the program
     * step.
     */
    targetValue?: UABaseDataVariable<number, DataType.Double>;
    /**
     * tracePointIndex
     * The optional TracePointIndex is the index to the
     * trace sample array from which corresponds to this
     * specific result.
     */
    tracePointIndex?: UABaseDataVariable<Int32, DataType.Int32>;
    /**
     * tracePointTimeOffset
     * The optional TracePointTimeOffset is the time
     * offset (in seconds) to point out the absolute
     * time point in the array of trace samples. This
     * may or may not match with an element in the
     * TraceContent array. If it is not  available in
     * the TraceContent array, the value can be
     * visualized in the trace graph via interpolation
     * or some other plotting mechanisms.
     */
    tracePointTimeOffset?: UABaseDataVariable<number, DataType.Double>;
    /**
     * value
     * The mandatory Value is the measured value of the
     * given result. The value corresponds to the
     * PhysicalQuantity attribute of
     * JoiningDataVariableType.
     */
    value: UAJoiningDataVariable<number, DataType.Double>;
    /**
     * valueId
     * The optional ValueId is the system-wide unique
     * Identifier of the given value if it is available
     * in the system.
     */
    valueId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * valueTag
     * The optional ValueTag is an associated tag to the
     * given measurement value to classify it based on
     * the tightening domain. Examples: FINAL, YIELD,
     * SNUG, etc.
     */
    valueTag?: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * violationConsequence
     * The optional ViolationConsequence provides
     * information on the consequence occurred due to
     * the violation of the configurable limits.
     * Examples: Step Transition, Abort Tightening
     * Operation. Is the consequence repairable or not,
     * etc.
     */
    violationConsequence?: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * violationType
     * The optional ViolationType indicates whether the
     * measured value is above or below  the configured
     * limit. It is only relevant if program or step
     * configuration is violated.
     */
    violationType?: UABaseDataVariable<Byte, DataType.Byte>;
}
export interface UAResultValue<T extends DTResultValue> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAResultValue_Base<T> {
}