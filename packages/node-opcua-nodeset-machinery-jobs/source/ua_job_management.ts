// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAISA95JobOrderReceiverObject } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/dist/ua_isa_95_job_order_receiver_object"
import { UAISA95JobResponseProviderObject } from "node-opcua-nodeset-isa-95-jobcontrol-v-2/dist/ua_isa_95_job_response_provider_object"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JobManagementType i=1003                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAJobManagement_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    jobOrderControl: UAISA95JobOrderReceiverObject;
    jobOrderResults: UAISA95JobResponseProviderObject;
}
export interface UAJobManagement extends UAObject, UAJobManagement_Base {
}