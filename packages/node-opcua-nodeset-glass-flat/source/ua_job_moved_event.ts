// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAGlassEvent, UAGlassEvent_Base } from "./ua_glass_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:JobMovedEventType ns=13;i=1037                 |
 * |isAbstract      |true                                              |
 */
export interface UAJobMovedEvent_Base extends UAGlassEvent_Base {
    jobdIdentifier: UAProperty<UAString, /*z*/DataType.String>;
    newPosition?: UAProperty<any, any>;
}
export interface UAJobMovedEvent extends Omit<UAGlassEvent, "jobdIdentifier">, UAJobMovedEvent_Base {
}