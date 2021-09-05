// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |StateType ns=0;i=2307                             |
 * |isAbstract      |false                                             |
 */
export interface UAState_Base {
    stateNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAState extends UAObject, UAState_Base {
}