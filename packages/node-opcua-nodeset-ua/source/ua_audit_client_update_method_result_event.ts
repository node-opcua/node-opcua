// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { ExpandedNodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAAuditClientEvent, UAAuditClientEvent_Base } from "./ua_audit_client_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditClientUpdateMethodResultEventType i=23926              |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditClientUpdateMethodResultEvent_Base extends UAAuditClientEvent_Base {
    objectId: UAProperty<ExpandedNodeId, DataType.ExpandedNodeId>;
    methodId: UAProperty<ExpandedNodeId, DataType.ExpandedNodeId>;
    statusCodeId: UAProperty<StatusCode, DataType.StatusCode>;
    inputArguments: UAProperty<any, any>;
    outputArguments: UAProperty<any, any>;
}
export interface UAAuditClientUpdateMethodResultEvent extends UAAuditClientEvent, UAAuditClientUpdateMethodResultEvent_Base {
}