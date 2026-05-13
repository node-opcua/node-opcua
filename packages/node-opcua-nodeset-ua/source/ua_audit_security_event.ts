import type { UAProperty } from "node-opcua-address-space-base";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditSecurityEventType i=2058                               |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditSecurityEvent_Base extends UAAuditEvent_Base {
    statusCodeId?: UAProperty<StatusCode, DataType.StatusCode>;
}
export interface UAAuditSecurityEvent extends UAAuditEvent, UAAuditSecurityEvent_Base {}