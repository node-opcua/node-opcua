// ----- this file has been automatically generated - do not edit
import { DTResult } from "node-opcua-nodeset-machinery-result/dist/dt_result"
import { UAResultReadyEvent, UAResultReadyEvent_Base } from "node-opcua-nodeset-machinery-result/dist/ua_result_ready_event"
import { UAResult } from "node-opcua-nodeset-machinery-result/dist/ua_result"

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
    result: UAResult<DTResult>;
}
export interface UAJoiningSystemResultReadyEvent extends Omit<UAResultReadyEvent, "result">, UAJoiningSystemResultReadyEvent_Base {
}