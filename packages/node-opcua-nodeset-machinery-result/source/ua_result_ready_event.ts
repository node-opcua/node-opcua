// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { Int64, Int32, UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTResult } from "./dt_result"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluationEnum } from "./enum_result_evaluation_enum"
import { DTResultMeta } from "./dt_result_meta"
import { UAResult } from "./ua_result"
/**
 * Provides information of a complete or partial
 * result.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/Result/               |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultReadyEventType i=1002                                 |
 * |isAbstract      |true                                                        |
 */
export interface UAResultReadyEvent_Base extends UABaseEvent_Base {
    result: UAResult<DTResult>;
}
export interface UAResultReadyEvent extends UABaseEvent, UAResultReadyEvent_Base {
}