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
 * |typedDefinition |4:AcquisitionDoneEventType ns=4;i=1025            |
 * |isAbstract      |false                                             |
 */
export interface UAAcquisitionDoneEvent_Base extends UABaseEvent_Base {
    jobId: UAProperty<DTJobId, /*z*/DataType.ExtensionObject>;
}
export interface UAAcquisitionDoneEvent extends UABaseEvent, UAAcquisitionDoneEvent_Base {
}