// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |TransitionType ns=0;i=2310                        |
 * |isAbstract      |false                                             |
 */
export interface UATransition_Base {
    transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UATransition extends UAObject, UATransition_Base {
}