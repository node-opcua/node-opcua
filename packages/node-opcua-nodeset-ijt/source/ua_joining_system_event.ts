// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * This is a general event defined to send any type
 * of errors, alerts, system specific information.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:JoiningSystemEventType ns=14;i=1006            |
 * |isAbstract      |false                                             |
 */
export interface UAJoiningSystemEvent_Base extends UABaseEvent_Base {
    /**
     * joiningTechnology
     * The optional JoiningTechnology is a human
     * readable text to identify which joining
     * technology triggered the event.
     */
    joiningTechnology?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAJoiningSystemEvent extends UABaseEvent, UAJoiningSystemEvent_Base {
}