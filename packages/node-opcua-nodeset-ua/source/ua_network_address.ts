// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UASelectionList } from "./ua_selection_list"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NetworkAddressType ns=0;i=21145                   |
 * |isAbstract      |true                                              |
 */
export interface UANetworkAddress_Base {
    networkInterface: UASelectionList<UAString, /*z*/DataType.String>;
}
export interface UANetworkAddress extends UAObject, UANetworkAddress_Base {
}