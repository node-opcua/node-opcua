import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditCreateSessionEvent, UAAuditCreateSessionEvent_Base } from "./ua_audit_create_session_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditUrlMismatchEventType i=2748                            |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditUrlMismatchEvent_Base extends UAAuditCreateSessionEvent_Base {
    endpointUrl: UAProperty<UAString, DataType.String>;
}
export interface UAAuditUrlMismatchEvent extends UAAuditCreateSessionEvent, UAAuditUrlMismatchEvent_Base {}