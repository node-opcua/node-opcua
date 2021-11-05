// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTProgramDiagnostic2 } from "./dt_program_diagnostic_2"
import { DTArgument } from "./dt_argument"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ProgramDiagnostic2Type ns=0;i=15383               |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTProgramDiagnostic2 ns=0;i=24033                 |
 * |isAbstract      |false                                             |
 */
export interface UAProgramDiagnostic2_Base<T extends DTProgramDiagnostic2/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    createSessionId: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    createClientName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    invocationCreationTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    lastTransitionTime: UAProperty<Date, /*z*/DataType.DateTime>;
    lastMethodCall: UABaseDataVariable<UAString, /*z*/DataType.String>;
    lastMethodSessionId: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    lastMethodInputArguments: UABaseDataVariable<DTArgument[], /*z*/DataType.ExtensionObject>;
    lastMethodOutputArguments: UABaseDataVariable<DTArgument[], /*z*/DataType.ExtensionObject>;
    lastMethodInputValues: UABaseDataVariable<any, any>;
    lastMethodOutputValues: UABaseDataVariable<any, any>;
    lastMethodCallTime: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    lastMethodReturnStatus: UABaseDataVariable<StatusCode, /*z*/DataType.StatusCode>;
}
export interface UAProgramDiagnostic2<T extends DTProgramDiagnostic2/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAProgramDiagnostic2_Base<T /*B*/> {
}