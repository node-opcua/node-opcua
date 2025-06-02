// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { EnumManAddrIfSubtype } from "./enum_man_addr_if_subtype"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LldpManagementAddressType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTLldpManagementAddress extends DTStructure {
  addressSubtype: UInt32; // UInt32 ns=0;i=7
  address: UAString; // String ns=0;i=12
  ifSubtype: EnumManAddrIfSubtype; // Int32 ns=0;i=18951
  ifId: UInt32; // UInt32 ns=0;i=7
}
export interface UDTLldpManagementAddress extends ExtensionObject, DTLldpManagementAddress {};