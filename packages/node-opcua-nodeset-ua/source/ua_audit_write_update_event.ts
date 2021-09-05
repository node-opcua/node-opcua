// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { UAAuditUpdateEvent, UAAuditUpdateEvent_Base } from "./ua_audit_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditWriteUpdateEventType ns=0;i=2100             |
 * |isAbstract      |true                                              |
 */
export interface UAAuditWriteUpdateEvent_Base extends UAAuditUpdateEvent_Base {
    attributeId: UAProperty<UInt32, /*z*/DataType.UInt32>;
    indexRange: UAProperty<UAString, /*z*/DataType.String>;
    oldValue: UAProperty<any, any>;
    newValue: UAProperty<any, any>;
}
export interface UAAuditWriteUpdateEvent extends UAAuditUpdateEvent, UAAuditWriteUpdateEvent_Base {
}