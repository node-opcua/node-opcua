import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TrustListDataType                                           |
 * | isAbstract|false                                                       |
 */
export interface DTTrustList extends DTStructure {
  specifiedLists: UInt32; // UInt32 ns=0;i=7
  trustedCertificates: Buffer[]; // ByteString ns=0;i=15
  trustedCrls: Buffer[]; // ByteString ns=0;i=15
  issuerCertificates: Buffer[]; // ByteString ns=0;i=15
  issuerCrls: Buffer[]; // ByteString ns=0;i=15
}
export interface UDTTrustList extends ExtensionObject, DTTrustList {};