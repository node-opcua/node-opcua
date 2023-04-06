// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * Provides information, that a zero-point
 * adjustment took place
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/ProcessValues/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |21:ZeroPointAdjustmentEventType ns=21;i=1002      |
 * |isAbstract      |true                                              |
 */
export interface UAZeroPointAdjustmentEvent_Base extends UABaseEvent_Base {
    zeroPointAdjustmentResult: UAProperty<StatusCode, DataType.StatusCode>;
}
export interface UAZeroPointAdjustmentEvent extends UABaseEvent, UAZeroPointAdjustmentEvent_Base {
}