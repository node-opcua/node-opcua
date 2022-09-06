// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTTrace } from "./dt_trace"
/**
 * It is a base type to encapsulate common data for
 * a Trace.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:TraceType ns=14;i=2009                         |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTTrace ns=14;i=3011                              |
 * |isAbstract      |false                                             |
 */
export interface UATrace_Base<T extends DTTrace>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * resultId
     * The mandatory ResultId is the system-wide unique
     * identifier of the associated result. This is
     * useful to link Result and Trace instances when
     * the Result and Trace are sent separately.
     */
    resultId: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * traceId
     * The mandatory TraceId is the system-wide unique
     * identifier of the Trace.
     */
    traceId: UABaseDataVariable<Guid, DataType.Guid>;
}
export interface UATrace<T extends DTTrace> extends UABaseDataVariable<T, DataType.ExtensionObject>, UATrace_Base<T> {
}