import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditChannelEventType i=2059                                |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditChannelEvent_Base extends UAAuditSecurityEvent_Base {
    secureChannelId: UAProperty<UAString, DataType.String>;
}
export interface UAAuditChannelEvent extends UAAuditSecurityEvent, UAAuditChannelEvent_Base {}