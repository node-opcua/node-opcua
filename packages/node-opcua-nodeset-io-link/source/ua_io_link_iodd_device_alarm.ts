import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UAIOLinkDeviceAlarm, UAIOLinkDeviceAlarm_Base } from "./ua_io_link_device_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOLinkIODDDeviceAlarmType i=1009                            |
 * |isAbstract      |false                                                       |
 */
export interface UAIOLinkIODDDeviceAlarm_Base extends UAIOLinkDeviceAlarm_Base {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAIOLinkIODDDeviceAlarm extends UAIOLinkDeviceAlarm, UAIOLinkIODDDeviceAlarm_Base {}