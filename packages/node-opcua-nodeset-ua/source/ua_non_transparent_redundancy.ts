// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAServerRedundancy, UAServerRedundancy_Base } from "./ua_server_redundancy"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NonTransparentRedundancyType ns=0;i=2039          |
 * |isAbstract      |false                                             |
 */
export interface UANonTransparentRedundancy_Base extends UAServerRedundancy_Base {
    serverUriArray: UAProperty<UAString[], /*z*/DataType.String>;
}
export interface UANonTransparentRedundancy extends UAServerRedundancy, UANonTransparentRedundancy_Base {
}