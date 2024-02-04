// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAAuditClientEvent, UAAuditClientEvent_Base } from "./ua_audit_client_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditClientUpdateMethodResultEventType i=23926              |
 * |isAbstract      |false                                                       |
 */
export interface UAAuditClientUpdateMethodResultEvent_Base extends UAAuditClientEvent_Base {
    objectId: UAProperty<NodeId, DataType.NodeId>;
    methodId: UAProperty<NodeId, DataType.NodeId>;
    statusCodeId: UAProperty<StatusCode, DataType.StatusCode>;
    inputArguments: UAProperty<any, any>;
    outputArguments: UAProperty<any, any>;
}
export interface UAAuditClientUpdateMethodResultEvent extends UAAuditClientEvent, UAAuditClientUpdateMethodResultEvent_Base {
}