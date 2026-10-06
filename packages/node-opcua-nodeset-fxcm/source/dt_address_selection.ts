import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTNetworkAddress } from "node-opcua-nodeset-ua/dist/dt_network_address.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AddressSelectionDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTAddressSelection extends DTStructure {
  address?: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  addressSelection?: DTNetworkAddress[]; // ExtensionObject ns=0;i=15502
  addressModify: boolean; // Boolean ns=0;i=1
}
export interface UDTAddressSelection extends ExtensionObject, DTAddressSelection {};