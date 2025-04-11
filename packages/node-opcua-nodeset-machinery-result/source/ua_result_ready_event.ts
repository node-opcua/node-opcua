// ----- this file has been automatically generated - do not edit
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
import { DTResult } from "./dt_result"
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