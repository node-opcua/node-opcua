import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SignalType i=1008                                           |
 * |isAbstract      |false                                                       |
 */
export interface UASignal_Base {
    signalTag: UAProperty<UAString, DataType.String>;
}
export interface UASignal extends UAObject, UASignal_Base {}