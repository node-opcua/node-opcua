// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTProgramDiagnostic } from "./dt_program_diagnostic"
import { DTStatusResult } from "./dt_status_result"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ProgramDiagnosticType ns=0;i=2380                 |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTProgramDiagnostic ns=0;i=894                    |
 * |isAbstract      |false                                             |
 */
export interface UAProgramDiagnostic_Base<T extends DTProgramDiagnostic/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    createSessionId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    createClientName: UAProperty<UAString, /*z*/DataType.String>;
    invocationCreationTime: UAProperty<Date, /*z*/DataType.DateTime>;
    lastTransitionTime: UAProperty<Date, /*z*/DataType.DateTime>;
    lastMethodCall: UAProperty<UAString, /*z*/DataType.String>;
    lastMethodSessionId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    lastMethodInputArguments: UAProperty<any, any>;
    lastMethodOutputArguments: UAProperty<any, any>;
    lastMethodCallTime: UAProperty<Date, /*z*/DataType.DateTime>;
    lastMethodReturnStatus: UAProperty<DTStatusResult, /*z*/DataType.ExtensionObject>;
}
export interface UAProgramDiagnostic<T extends DTProgramDiagnostic/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAProgramDiagnostic_Base<T /*B*/> {
}