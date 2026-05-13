import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUpdateEvent, UAAuditUpdateEvent_Base } from "./ua_audit_update_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditWriteUpdateEventType i=2100                            |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditWriteUpdateEvent_Base extends UAAuditUpdateEvent_Base {
    attributeId: UAProperty<UInt32, DataType.UInt32>;
    indexRange: UAProperty<UAString, DataType.String>;
    oldValue: UAProperty<any, any>;
    newValue: UAProperty<any, any>;
}
export interface UAAuditWriteUpdateEvent extends UAAuditUpdateEvent, UAAuditWriteUpdateEvent_Base {}