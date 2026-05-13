import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditSessionEventType i=2069                                |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditSessionEvent_Base extends UAAuditSecurityEvent_Base {
    sessionId: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAAuditSessionEvent extends UAAuditSecurityEvent, UAAuditSessionEvent_Base {}