import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditSessionEvent, UAAuditSessionEvent_Base } from "./ua_audit_session_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditCancelEventType i=2078                                 |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditCancelEvent_Base extends UAAuditSessionEvent_Base {
    requestHandle: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAAuditCancelEvent extends UAAuditSessionEvent, UAAuditCancelEvent_Base {}