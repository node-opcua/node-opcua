// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "./ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ProgressEventType ns=0;i=11436                    |
 * |isAbstract      |true                                              |
 */
export interface UAProgressEvent_Base extends UABaseEvent_Base {
    context: UAProperty<any, any>;
    progress: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAProgressEvent extends UABaseEvent, UAProgressEvent_Base {
}