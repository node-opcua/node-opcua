import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransitionType i=2310                                       |
 * |isAbstract      |false                                                       |
 */
export interface UATransition_Base {
    transitionNumber: UAProperty<UInt32, DataType.UInt32>;
}
export interface UATransition extends UAObject, UATransition_Base {}