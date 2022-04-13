// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EnumRedundancySupport } from "./enum_redundancy_support"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerRedundancyType ns=0;i=2034                  |
 * |isAbstract      |false                                             |
 */
export interface UAServerRedundancy_Base {
    redundancySupport: UAProperty<EnumRedundancySupport, /*z*/DataType.Int32>;
}
export interface UAServerRedundancy extends UAObject, UAServerRedundancy_Base {
}