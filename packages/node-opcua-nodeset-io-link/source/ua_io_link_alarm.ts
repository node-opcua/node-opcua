import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UAOffNormalAlarm, UAOffNormalAlarm_Base } from "node-opcua-nodeset-ua/dist/ua_off_normal_alarm";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOLinkAlarmType i=1007                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIOLinkAlarm_Base extends UAOffNormalAlarm_Base {
    ioLinkEventCode: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkAlarm extends UAOffNormalAlarm, UAIOLinkAlarm_Base {}