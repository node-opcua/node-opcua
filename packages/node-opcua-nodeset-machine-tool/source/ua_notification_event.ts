import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NotificationEventType i=35                                  |
 * |isAbstract      |true                                                        |
 */
export interface UANotificationEvent_Base extends UABaseEvent_Base {
    identifier: UAProperty<UAString, DataType.String>;
}
export interface UANotificationEvent extends UABaseEvent, UANotificationEvent_Base {}