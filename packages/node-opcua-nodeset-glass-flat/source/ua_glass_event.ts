// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GlassEventType i=1030                                       |
 * |isAbstract      |true                                                        |
 */
export interface UAGlassEvent_Base extends UABaseEvent_Base {
    identifier?: UAProperty<UAString, DataType.String>;
    jobdIdentifier?: UAProperty<UAString, DataType.String>;
    location?: UAProperty<UAString, DataType.String>;
    materialIdentifier?: UAProperty<UAString, DataType.String>;
}
export interface UAGlassEvent extends UABaseEvent, UAGlassEvent_Base {
}