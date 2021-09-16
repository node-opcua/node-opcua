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
 * |typedDefinition |4:ReadyEventType ns=4;i=1023                      |
 * |isAbstract      |false                                             |
 */
export interface UAReadyEvent_Base extends UABaseEvent_Base {
    jobId: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
}
export interface UAReadyEvent extends UABaseEvent, UAReadyEvent_Base {
}