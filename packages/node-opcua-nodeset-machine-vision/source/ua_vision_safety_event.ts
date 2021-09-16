// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:VisionSafetyEventType ns=4;i=1030               |
 * |isAbstract      |false                                             |
 */
export interface UAVisionSafetyEvent_Base extends UABaseEvent_Base {
    visionSafetyInformation: UAProperty<UAString, /*z*/DataType.String>;
    visionSafetyTriggered: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAVisionSafetyEvent extends UABaseEvent, UAVisionSafetyEvent_Base {
}