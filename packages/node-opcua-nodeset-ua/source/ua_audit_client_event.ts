import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditClientEventType i=23606                                |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditClientEvent_Base extends UAAuditEvent_Base {
    serverUri: UAProperty<UAString, DataType.String>;
}
export interface UAAuditClientEvent extends UAAuditEvent, UAAuditClientEvent_Base {}