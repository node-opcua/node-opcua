import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

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