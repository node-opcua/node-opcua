// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTTighteningTrace } from "./dt_tightening_trace"
import { DTStepTrace } from "./dt_step_trace"
import { UATrace, UATrace_Base } from "./ua_trace"
/**
 * The TighteningTraceType is a subtype of the
 * TraceType. This structure is to describe the
 * content of traces for all the steps in the given
 * program.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:TighteningTraceType ns=14;i=2010               |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTTighteningTrace ns=14;i=3012                    |
 * |isAbstract      |false                                             |
 */
export interface UATighteningTrace_Base<T extends DTTighteningTrace>  extends UATrace_Base<T> {
    /**
     * stepTraces
     * The mandatory StepTraces is an array of
     * StepTraceType which provides trace content for
     * each step in the given program.
     */
    stepTraces: UABaseDataVariable<DTStepTrace, DataType.ExtensionObject>;
}
export interface UATighteningTrace<T extends DTTighteningTrace> extends UATrace<T>, UATighteningTrace_Base<T> {
}