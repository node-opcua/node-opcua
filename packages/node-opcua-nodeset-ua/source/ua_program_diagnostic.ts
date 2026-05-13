import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTProgramDiagnostic } from "./dt_program_diagnostic";
import type { DTStatusResult } from "./dt_status_result";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ProgramDiagnosticType i=2380                                |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTProgramDiagnostic i=894                                   |
 * |value rank      |-1                                                          |
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
export interface UAProgramDiagnostic<T extends DTProgramDiagnostic> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAProgramDiagnostic_Base<T> {}