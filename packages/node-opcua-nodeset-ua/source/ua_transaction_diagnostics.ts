// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { DTTransactionError } from "./dt_transaction_error"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransactionDiagnosticsType i=32286                          |
 * |isAbstract      |false                                                       |
 */
export interface UATransactionDiagnostics_Base {
    startTime: UAProperty<Date, DataType.DateTime>;
    endTime: UAProperty<Date, DataType.DateTime>;
    result: UAProperty<StatusCode, DataType.StatusCode>;
    affectedTrustLists: UAProperty<NodeId[], DataType.NodeId>;
    affectedCertificateGroups: UAProperty<NodeId[], DataType.NodeId>;
    errors: UAProperty<DTTransactionError[], DataType.ExtensionObject>;
}
export interface UATransactionDiagnostics extends UAObject, UATransactionDiagnostics_Base {
}