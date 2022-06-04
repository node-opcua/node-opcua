// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { DTArgument } from "./dt_argument"
import { UAAuditClientEvent, UAAuditClientEvent_Base } from "./ua_audit_client_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditClientUpdateMethodResultEventType ns=0;i=23926|
 * |isAbstract      |false                                             |
 */
export interface UAAuditClientUpdateMethodResultEvent_Base extends UAAuditClientEvent_Base {
    objectId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    methodId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    statusCodeId: UAProperty<StatusCode, /*z*/DataType.StatusCode>;
    inputArguments: UAProperty<DTArgument[], /*z*/DataType.ExtensionObject>;
    outputArguments: UAProperty<DTArgument[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditClientUpdateMethodResultEvent extends UAAuditClientEvent, UAAuditClientUpdateMethodResultEvent_Base {
}