// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTProgramDiagnostic2 } from "./dt_program_diagnostic_2"
import { DTArgument } from "./dt_argument"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ProgramDiagnostic2Type i=15383                              |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTProgramDiagnostic2 i=24033                                |
 * |isAbstract      |false                                                       |
 */
export interface UAProgramDiagnostic2_Base<T extends DTProgramDiagnostic2>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    createSessionId: UABaseDataVariable<NodeId, DataType.NodeId>;
    createClientName: UABaseDataVariable<UAString, DataType.String>;
    invocationCreationTime: UABaseDataVariable<Date, DataType.DateTime>;
    lastTransitionTime: UAProperty<Date, DataType.DateTime>;
    lastMethodCall: UABaseDataVariable<UAString, DataType.String>;
    lastMethodSessionId: UABaseDataVariable<NodeId, DataType.NodeId>;
    lastMethodInputArguments: UABaseDataVariable<DTArgument[], DataType.ExtensionObject>;
    lastMethodOutputArguments: UABaseDataVariable<DTArgument[], DataType.ExtensionObject>;
    lastMethodInputValues: UABaseDataVariable<any, any>;
    lastMethodOutputValues: UABaseDataVariable<any, any>;
    lastMethodCallTime: UABaseDataVariable<Date, DataType.DateTime>;
    lastMethodReturnStatus: UABaseDataVariable<StatusCode, DataType.StatusCode>;
}
export interface UAProgramDiagnostic2<T extends DTProgramDiagnostic2> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAProgramDiagnostic2_Base<T> {
}