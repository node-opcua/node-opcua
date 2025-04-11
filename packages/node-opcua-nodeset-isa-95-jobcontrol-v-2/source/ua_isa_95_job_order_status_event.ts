// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
import { DTISA95JobOrder } from "./dt_isa_95_job_order"
import { DTISA95JobResponse } from "./dt_isa_95_job_response"
import { DTISA95State } from "./dt_isa_95_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95JobOrderStatusEventType i=1006                         |
 * |isAbstract      |true                                                        |
 */
export interface UAISA95JobOrderStatusEvent_Base extends UABaseEvent_Base {
    jobOrder: UAProperty<DTISA95JobOrder, DataType.ExtensionObject>;
    jobResponse: UAProperty<DTISA95JobResponse, DataType.ExtensionObject>;
    jobState: UAProperty<DTISA95State[], DataType.ExtensionObject>;
}
export interface UAISA95JobOrderStatusEvent extends UABaseEvent, UAISA95JobOrderStatusEvent_Base {
}