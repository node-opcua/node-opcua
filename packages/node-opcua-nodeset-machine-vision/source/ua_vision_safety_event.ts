import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VisionSafetyEventType i=1030                                |
 * |isAbstract      |false                                                       |
 */
export interface UAVisionSafetyEvent_Base extends UABaseEvent_Base {
    visionSafetyInformation: UAProperty<UAString, DataType.String>;
    visionSafetyTriggered: UAProperty<boolean, DataType.Boolean>;
}
export interface UAVisionSafetyEvent extends UABaseEvent, UAVisionSafetyEvent_Base {}