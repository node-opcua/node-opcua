// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TrustListUpdatedAuditEventType i=12561                      |
 * |isAbstract      |true                                                        |
 */
export interface UATrustListUpdatedAuditEvent_Base extends UAAuditEvent_Base {
    trustListId: UAProperty<NodeId, DataType.NodeId>;
}
export interface UATrustListUpdatedAuditEvent extends UAAuditEvent, UATrustListUpdatedAuditEvent_Base {
}