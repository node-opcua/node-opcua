import type { UAProperty } from "node-opcua-address-space-base";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

import type { DTJobId } from "./dt_job_id";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ReadyEventType i=1023                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAReadyEvent_Base extends UABaseEvent_Base {
    jobId: UAProperty<DTJobId, DataType.ExtensionObject>;
}
export interface UAReadyEvent extends UABaseEvent, UAReadyEvent_Base {}