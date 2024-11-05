// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
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