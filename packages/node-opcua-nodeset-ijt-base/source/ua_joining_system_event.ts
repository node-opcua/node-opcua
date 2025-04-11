// ----- this file has been automatically generated - do not edit
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
import { UAJoiningSystemEventContent } from "./ua_joining_system_event_content"
/**
 * The JoiningSystemEventType is used to send any
 * type of events from a joining system. 
 * Note: The type of event is determined by the
 * usage of respective Condition Class(es) and
 * Condition SubClass(es) properties defined in
 * 0:BaseEventType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningSystemEventType i=1006                               |
 * |isAbstract      |true                                                        |
 */
export interface UAJoiningSystemEvent_Base extends UABaseEvent_Base {
    /**
     * joiningSystemEventContent
     * JoiningSystemEventContent is the common payload
     * of the event from a joining system.
     */
    joiningSystemEventContent?: UAJoiningSystemEventContent<any, any>;
}
export interface UAJoiningSystemEvent extends UABaseEvent, UAJoiningSystemEvent_Base {
}