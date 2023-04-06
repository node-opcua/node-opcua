// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAOffNormalAlarm, UAOffNormalAlarm_Base } from "node-opcua-nodeset-ua/source/ua_off_normal_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkAlarmType ns=17;i=1007                   |
 * |isAbstract      |true                                              |
 */
export interface UAIOLinkAlarm_Base extends UAOffNormalAlarm_Base {
    ioLinkEventCode: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIOLinkAlarm extends UAOffNormalAlarm, UAIOLinkAlarm_Base {
}