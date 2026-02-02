// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
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
export interface UAConfigurationUpdatedAuditEvent extends UAAuditEvent, UAConfigurationUpdatedAuditEvent_Base {
}