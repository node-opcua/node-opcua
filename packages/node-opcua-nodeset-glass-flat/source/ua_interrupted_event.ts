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
 * |typedDefinition |13:InterruptedEventType ns=13;i=1032              |
 * |isAbstract      |true                                              |
 */
export interface UAInterruptedEvent_Base extends UAGlassEvent_Base {
    processName?: UAProperty<UAString, DataType.String>;
}
export interface UAInterruptedEvent extends UAGlassEvent, UAInterruptedEvent_Base {
}