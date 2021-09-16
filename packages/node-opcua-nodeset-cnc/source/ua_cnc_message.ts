// ----- this file has been automatically generated - do not edit
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * Event transmitting simple information messages.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncMessageType ns=11;i=1011                    |
 * |isAbstract      |false                                             |
 */
export interface UACncMessage_Base extends UABaseEvent_Base {
}
export interface UACncMessage extends UABaseEvent, UACncMessage_Base {
}