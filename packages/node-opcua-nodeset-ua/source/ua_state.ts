import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StateType i=2307                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAState_Base {
    stateNumber: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAState extends UAObject, UAState_Base {}