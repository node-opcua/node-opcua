// ----- this file has been automatically generated - do not edit
import { UAJoiningSystemResultReadyEvent, UAJoiningSystemResultReadyEvent_Base } from "./ua_joining_system_result_ready_event"
/**
 * This EventType provides the requested results
 * from the Server using RequestResults method or
 * RequestUnacknowledgedResults method.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RequestedResultEventType i=1035                             |
 * |isAbstract      |true                                                        |
 */
export type UARequestedResultEvent_Base = UAJoiningSystemResultReadyEvent_Base;
export interface UARequestedResultEvent extends UAJoiningSystemResultReadyEvent, UARequestedResultEvent_Base {
}