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
 * |typedDefinition |CertificateUpdatedAuditEventType i=12620                    |
 * |isAbstract      |true                                                        |
 */
export interface UACertificateUpdatedAuditEvent_Base extends UAAuditEvent_Base {
    certificateGroup: UAProperty<NodeId, DataType.NodeId>;
    certificateType: UAProperty<NodeId, DataType.NodeId>;
}
export interface UACertificateUpdatedAuditEvent extends UAAuditEvent, UACertificateUpdatedAuditEvent_Base {
}