// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, Byte, Guid } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTResult } from "./dt_result"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { DTTag } from "./dt_tag"
import { UAResult } from "./ua_result"
/**
 * This event is to be triggered by the server when
 * the tightening system has a complete or partial
 * result available for the client.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:ResultReadyEventType ns=14;i=1007              |
 * |isAbstract      |false                                             |
 */
export interface UAResultReadyEvent_Base extends UABaseEvent_Base {
    /**
     * result
     * The mandatory Result Variable is an instance of
     * ResultType with required mandatory and optional
     * parameters.
     */
    result: UAResult<DTResult>;
}
export interface UAResultReadyEvent extends UABaseEvent, UAResultReadyEvent_Base {
}