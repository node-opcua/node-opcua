// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTRedundantServer } from "./dt_redundant_server"
import { UAServerRedundancy, UAServerRedundancy_Base } from "./ua_server_redundancy"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransparentRedundancyType i=2036                            |
 * |isAbstract      |false                                                       |
 */
export interface UATransparentRedundancy_Base extends UAServerRedundancy_Base {
    redundantServerArray: UAProperty<DTRedundantServer[], DataType.ExtensionObject>;
    currentServerId: UAProperty<UAString, DataType.String>;
}
export interface UATransparentRedundancy extends Omit<UAServerRedundancy, "redundantServerArray">, UATransparentRedundancy_Base {
}