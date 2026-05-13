import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UASelectionList } from "./ua_selection_list";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NetworkAddressType i=21145                                  |
 * |isAbstract      |true                                                        |
 */
export interface UANetworkAddress_Base {
    networkInterface: UASelectionList<UAString, DataType.String>;
}
export interface UANetworkAddress extends UAObject, UANetworkAddress_Base {}