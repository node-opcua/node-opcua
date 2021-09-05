// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTRedundantServer } from "./dt_redundant_server"
import { UAServerRedundancy, UAServerRedundancy_Base } from "./ua_server_redundancy"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |TransparentRedundancyType ns=0;i=2036             |
 * |isAbstract      |false                                             |
 */
export interface UATransparentRedundancy_Base extends UAServerRedundancy_Base {
    currentServerId: UAProperty<UAString, /*z*/DataType.String>;
    redundantServerArray: UAProperty<DTRedundantServer[], /*z*/DataType.ExtensionObject>;
}
export interface UATransparentRedundancy extends UAServerRedundancy, UATransparentRedundancy_Base {
}