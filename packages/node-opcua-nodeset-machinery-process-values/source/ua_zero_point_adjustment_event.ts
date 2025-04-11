// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
/**
 * Provides information, that a zero-point
 * adjustment took place
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/ProcessValues/        |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ZeroPointAdjustmentEventType i=1002                         |
 * |isAbstract      |true                                                        |
 */
export interface UAZeroPointAdjustmentEvent_Base extends UABaseEvent_Base {
    zeroPointAdjustmentResult: UAProperty<StatusCode, DataType.StatusCode>;
}
export interface UAZeroPointAdjustmentEvent extends UABaseEvent, UAZeroPointAdjustmentEvent_Base {
}