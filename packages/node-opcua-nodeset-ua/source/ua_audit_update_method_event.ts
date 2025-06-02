// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditUpdateMethodEventType i=2127                           |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditUpdateMethodEvent_Base extends UAAuditEvent_Base {
    methodId: UAProperty<NodeId, DataType.NodeId>;
    statusCodeId?: UAProperty<StatusCode, DataType.StatusCode>;
    inputArguments: UAProperty<any, any>;
    outputArguments?: UAProperty<any, any>;
}
export interface UAAuditUpdateMethodEvent extends UAAuditEvent, UAAuditUpdateMethodEvent_Base {
}