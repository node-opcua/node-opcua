import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SignatureData                                               |
 * | isAbstract|false                                                       |
 */
export interface DTSignatureData extends DTStructure {
  algorithm: UAString; // String ns=0;i=12
  signature: Buffer; // ByteString ns=0;i=15
}
export interface UDTSignatureData extends ExtensionObject, DTSignatureData {};