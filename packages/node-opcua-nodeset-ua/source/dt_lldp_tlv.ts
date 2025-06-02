// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LldpTlvType                                                 |
 * | isAbstract|false                                                       |
 */
export interface DTLldpTlv extends DTStructure {
  tlvType: UInt32; // UInt32 ns=0;i=7
  tlvInfo: Buffer; // ByteString ns=0;i=15
}
export interface UDTLldpTlv extends ExtensionObject, DTLldpTlv {};