// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerRedundancyType ns=0;i=2034                  |
 * |isAbstract      |false                                             |
 */
export interface UAServerRedundancy_Base {
    redundancySupport: UAProperty<any, any>;
}
export interface UAServerRedundancy extends UAObject, UAServerRedundancy_Base {
}