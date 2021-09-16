// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UATransitionEvent, UATransitionEvent_Base } from "node-opcua-nodeset-ua/source/ua_transition_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ErrorEventType ns=4;i=1019                      |
 * |isAbstract      |false                                             |
 */
export interface UAErrorEvent_Base extends UATransitionEvent_Base {
}
export interface UAErrorEvent extends UATransitionEvent, UAErrorEvent_Base {
}