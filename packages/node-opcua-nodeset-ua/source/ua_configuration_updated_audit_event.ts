import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationUpdatedAuditEventType i=15541                  |
 * |isAbstract      |true                                                        |
 */
export interface UAConfigurationUpdatedAuditEvent_Base extends UAAuditEvent_Base {
    oldVersion: UAProperty<UInt32, DataType.UInt32>;
    newVersion: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAConfigurationUpdatedAuditEvent extends UAAuditEvent, UAConfigurationUpdatedAuditEvent_Base {}