import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAIOLinkEvent, UAIOLinkEvent_Base } from "./ua_io_link_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOLinkPortEventType i=1005                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIOLinkPortEvent_Base extends UAIOLinkEvent_Base {
    ioLinkEventCode: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkPortEvent extends Omit<UAIOLinkEvent, "ioLinkEventCode">, UAIOLinkPortEvent_Base {}