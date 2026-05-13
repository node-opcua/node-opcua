import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UAIOLinkDeviceEvent, UAIOLinkDeviceEvent_Base } from "./ua_io_link_device_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOLinkIODDDeviceEventType i=1021                            |
 * |isAbstract      |false                                                       |
 */
export interface UAIOLinkIODDDeviceEvent_Base extends UAIOLinkDeviceEvent_Base {
    name: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAIOLinkIODDDeviceEvent extends UAIOLinkDeviceEvent, UAIOLinkIODDDeviceEvent_Base {}