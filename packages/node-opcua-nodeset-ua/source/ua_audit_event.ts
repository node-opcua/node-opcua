import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditEventType i=2052                                       |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditEvent_Base extends UABaseEvent_Base {
    actionTimeStamp: UAProperty<Date, DataType.DateTime>;
    status: UAProperty<boolean, DataType.Boolean>;
    serverId: UAProperty<UAString, DataType.String>;
    clientAuditEntryId: UAProperty<UAString, DataType.String>;
    clientUserId: UAProperty<UAString, DataType.String>;
    clientApplicationUri?: UAProperty<UAString, DataType.String>;
}
export interface UAAuditEvent extends UABaseEvent, UAAuditEvent_Base {}