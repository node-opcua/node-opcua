// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
import { DTJobId } from "./dt_job_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:JobStartedEventType ns=4;i=1013                 |
 * |isAbstract      |false                                             |
 */
export interface UAJobStartedEvent_Base extends UABaseEvent_Base {
    jobId: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
}
export interface UAJobStartedEvent extends UABaseEvent, UAJobStartedEvent_Base {
}