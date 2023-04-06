// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAIOLinkDeviceAlarm, UAIOLinkDeviceAlarm_Base } from "./ua_io_link_device_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkIODDDeviceAlarmType ns=17;i=1009         |
 * |isAbstract      |false                                             |
 */
export interface UAIOLinkIODDDeviceAlarm_Base extends UAIOLinkDeviceAlarm_Base {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAIOLinkIODDDeviceAlarm extends UAIOLinkDeviceAlarm, UAIOLinkIODDDeviceAlarm_Base {
}