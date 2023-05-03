// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTProgramDiagnostic } from "./dt_program_diagnostic"
import { DTStatusResult } from "./dt_status_result"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ProgramDiagnosticType i=2380                                |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTProgramDiagnostic i=894                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAProgramDiagnostic_Base<T extends DTProgramDiagnostic>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    createSessionId: UAProperty<NodeId, DataType.NodeId>;
    createClientName: UAProperty<UAString, DataType.String>;
    invocationCreationTime: UAProperty<Date, DataType.DateTime>;
    lastTransitionTime: UAProperty<Date, DataType.DateTime>;
    lastMethodCall: UAProperty<UAString, DataType.String>;
    lastMethodSessionId: UAProperty<NodeId, DataType.NodeId>;
    lastMethodInputArguments: UAProperty<any, any>;
    lastMethodOutputArguments: UAProperty<any, any>;
    lastMethodCallTime: UAProperty<Date, DataType.DateTime>;
    lastMethodReturnStatus: UAProperty<DTStatusResult, DataType.ExtensionObject>;
}
export interface UAProgramDiagnostic<T extends DTProgramDiagnostic> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAProgramDiagnostic_Base<T> {
}