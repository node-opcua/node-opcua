// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAIOLinkDeviceEvent, UAIOLinkDeviceEvent_Base } from "./ua_io_link_device_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkIODDDeviceEventType ns=17;i=1021         |
 * |isAbstract      |false                                             |
 */
export interface UAIOLinkIODDDeviceEvent_Base extends UAIOLinkDeviceEvent_Base {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAIOLinkIODDDeviceEvent extends UAIOLinkDeviceEvent, UAIOLinkIODDDeviceEvent_Base {
}