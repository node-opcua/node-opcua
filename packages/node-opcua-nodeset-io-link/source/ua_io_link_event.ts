// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkEventType ns=17;i=1003                   |
 * |isAbstract      |true                                              |
 */
export interface UAIOLinkEvent_Base extends UABaseEvent_Base {
    ioLinkEventCode: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkEvent extends UABaseEvent, UAIOLinkEvent_Base {
}