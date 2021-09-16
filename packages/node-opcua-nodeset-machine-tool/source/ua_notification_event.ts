// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:NotificationEventType ns=10;i=35               |
 * |isAbstract      |true                                              |
 */
export interface UANotificationEvent_Base extends UABaseEvent_Base {
    identifier: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UANotificationEvent extends UABaseEvent, UANotificationEvent_Base {
}