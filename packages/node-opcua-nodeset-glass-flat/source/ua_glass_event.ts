// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:GlassEventType ns=13;i=1030                    |
 * |isAbstract      |true                                              |
 */
export interface UAGlassEvent_Base extends UABaseEvent_Base {
    identifier?: UAProperty<UAString, DataType.String>;
    jobdIdentifier?: UAProperty<UAString, DataType.String>;
    location?: UAProperty<UAString, DataType.String>;
    materialIdentifier?: UAProperty<UAString, DataType.String>;
}
export interface UAGlassEvent extends UABaseEvent, UAGlassEvent_Base {
}