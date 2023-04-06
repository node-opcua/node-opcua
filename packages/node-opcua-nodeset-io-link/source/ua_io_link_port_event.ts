// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UAIOLinkEvent, UAIOLinkEvent_Base } from "./ua_io_link_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkPortEventType ns=17;i=1005               |
 * |isAbstract      |true                                              |
 */
export interface UAIOLinkPortEvent_Base extends UAIOLinkEvent_Base {
    ioLinkEventCode: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkPortEvent extends Omit<UAIOLinkEvent, "ioLinkEventCode">, UAIOLinkPortEvent_Base {
}