// ----- this file has been automatically generated - do not edit
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int64, Int32, Byte, UAString } from "node-opcua-basic-types"
import { DTResult } from "node-opcua-nodeset-machinery-result/source/dt_result"
import { DTProcessingTimes } from "node-opcua-nodeset-machinery-result/source/dt_processing_times"
import { EnumResultEvaluationEnum } from "node-opcua-nodeset-machinery-result/source/enum_result_evaluation_enum"
import { DTResultMeta } from "node-opcua-nodeset-machinery-result/source/dt_result_meta"
import { UAResultReadyEvent, UAResultReadyEvent_Base } from "node-opcua-nodeset-machinery-result/source/ua_result_ready_event"
import { DTEntity } from "./dt_entity"
import { DTKeyValue } from "./dt_key_value"
import { DTResultCounter } from "./dt_result_counter"
import { DTJoiningResultMeta } from "./dt_joining_result_meta"
import { UAJoiningSystemResult } from "./ua_joining_system_result"
/**
 * This EventType provides information of a complete
 * or partial result from a joining system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningSystemResultReadyEventType i=1007                    |
 * |isAbstract      |true                                                        |
 */
export interface UAJoiningSystemResultReadyEvent_Base extends UAResultReadyEvent_Base {
    result: UAJoiningSystemResult<DTResult>;
}
export interface UAJoiningSystemResultReadyEvent extends Omit<UAResultReadyEvent, "result">, UAJoiningSystemResultReadyEvent_Base {
}