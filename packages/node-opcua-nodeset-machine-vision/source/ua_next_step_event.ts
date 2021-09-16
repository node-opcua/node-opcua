// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/source/ua_base_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:NextStepEventType ns=4;i=1028                   |
 * |isAbstract      |false                                             |
 */
export interface UANextStepEvent_Base extends UABaseEvent_Base {
    step: UAProperty<Int32, /*z*/DataType.Int32>;
}
export interface UANextStepEvent extends UABaseEvent, UANextStepEvent_Base {
}