// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "./ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditEventType ns=0;i=2052                        |
 * |isAbstract      |true                                              |
 */
export interface UAAuditEvent_Base extends UABaseEvent_Base {
    actionTimeStamp: UAProperty<Date, /*z*/DataType.DateTime>;
    status: UAProperty<boolean, /*z*/DataType.Boolean>;
    serverId: UAProperty<UAString, /*z*/DataType.String>;
    clientAuditEntryId: UAProperty<UAString, /*z*/DataType.String>;
    clientUserId: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditEvent extends UABaseEvent, UAAuditEvent_Base {
}