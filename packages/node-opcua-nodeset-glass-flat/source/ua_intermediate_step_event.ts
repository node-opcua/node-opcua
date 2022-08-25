// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAGlassEvent, UAGlassEvent_Base } from "./ua_glass_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:IntermediateStepEvent ns=13;i=1029             |
 * |isAbstract      |true                                              |
 */
export interface UAIntermediateStepEvent_Base extends UAGlassEvent_Base {
    processStep?: UAProperty<UAString, DataType.String>;
    status?: UAProperty<UAString, DataType.String>;
}
export interface UAIntermediateStepEvent extends UAGlassEvent, UAIntermediateStepEvent_Base {
}