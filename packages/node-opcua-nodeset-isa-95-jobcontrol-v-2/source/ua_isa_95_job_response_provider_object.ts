// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTISA95JobResponse } from "./dt_isa_95_job_response"
/**
 * The OPENSCSJobResponseProviderObjectType contains
 * a method to receive unsolicited job response
 * requests.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95JobResponseProviderObjectType i=1003                   |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95JobResponseProviderObject_Base {
    jobOrderResponseList?: UABaseDataVariable<DTISA95JobResponse[], DataType.ExtensionObject>;
    requestJobResponseByJobOrderID: UAMethod;
    requestJobResponseByJobOrderState: UAMethod;
}
export interface UAISA95JobResponseProviderObject extends UAObject, UAISA95JobResponseProviderObject_Base {
}