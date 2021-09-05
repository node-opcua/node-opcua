// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "./ua_audit_update_method_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |CertificateUpdatedAuditEventType ns=0;i=12620     |
 * |isAbstract      |true                                              |
 */
export interface UACertificateUpdatedAuditEvent_Base extends UAAuditUpdateMethodEvent_Base {
    certificateGroup: UAProperty<NodeId, /*z*/DataType.NodeId>;
    certificateType: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UACertificateUpdatedAuditEvent extends UAAuditUpdateMethodEvent, UACertificateUpdatedAuditEvent_Base {
}