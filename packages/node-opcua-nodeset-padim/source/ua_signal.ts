// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:SignalType ns=20;i=1008                        |
 * |isAbstract      |false                                             |
 */
export interface UASignal_Base {
    signalTag: UAProperty<UAString, DataType.String>;
}
export interface UASignal extends UAObject, UASignal_Base {
}