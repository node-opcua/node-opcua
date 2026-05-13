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
 * |typedDefinition |TrustListUpdatedAuditEventType i=12561                      |
 * |isAbstract      |true                                                        |
 */
export interface UATrustListUpdatedAuditEvent_Base extends UAAuditUpdateMethodEvent_Base {
    trustListId: UAProperty<NodeId, DataType.NodeId>;
}
export interface UATrustListUpdatedAuditEvent extends UAAuditUpdateMethodEvent, UATrustListUpdatedAuditEvent_Base {}