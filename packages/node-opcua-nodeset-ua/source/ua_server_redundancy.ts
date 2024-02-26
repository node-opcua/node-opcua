// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EnumRedundancySupport } from "./enum_redundancy_support"
import { DTRedundantServer } from "./dt_redundant_server"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerRedundancyType i=2034                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAServerRedundancy_Base {
    redundancySupport: UAProperty<EnumRedundancySupport, DataType.Int32>;
    redundantServerArray?: UAProperty<DTRedundantServer[], DataType.ExtensionObject>;
}
export interface UAServerRedundancy extends UAObject, UAServerRedundancy_Base {
}