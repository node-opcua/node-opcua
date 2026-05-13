import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "./ua_audit_update_method_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CertificateUpdatedAuditEventType i=12620                    |
 * |isAbstract      |true                                                        |
 */
export interface UACertificateUpdatedAuditEvent_Base extends UAAuditUpdateMethodEvent_Base {
    certificateGroup: UAProperty<NodeId, DataType.NodeId>;
    certificateType: UAProperty<NodeId, DataType.NodeId>;
}
export interface UACertificateUpdatedAuditEvent extends UAAuditUpdateMethodEvent, UACertificateUpdatedAuditEvent_Base {}