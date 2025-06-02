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
 * | name      |LldpManagementAddressTxPortType                             |
 * | isAbstract|false                                                       |
 */
export interface DTLldpManagementAddressTxPort extends DTStructure {
  addressSubtype: UInt32; // UInt32 ns=0;i=7
  manAddress: UAString; // String ns=0;i=12
  txEnable: boolean; // Boolean ns=0;i=1
  addrLen: UInt32; // UInt32 ns=0;i=7
  ifSubtype: EnumManAddrIfSubtype; // Int32 ns=0;i=18951
  ifId: UInt32; // UInt32 ns=0;i=7
}
export interface UDTLldpManagementAddressTxPort extends ExtensionObject, DTLldpManagementAddressTxPort {};