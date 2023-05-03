// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTNetworkGroup } from "./dt_network_group"
import { UANonTransparentRedundancy, UANonTransparentRedundancy_Base } from "./ua_non_transparent_redundancy"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonTransparentNetworkRedundancyType i=11945                 |
 * |isAbstract      |false                                                       |
 */
export interface UANonTransparentNetworkRedundancy_Base extends UANonTransparentRedundancy_Base {
    serverNetworkGroups: UAProperty<DTNetworkGroup[], DataType.ExtensionObject>;
}
export interface UANonTransparentNetworkRedundancy extends UANonTransparentRedundancy, UANonTransparentNetworkRedundancy_Base {
}