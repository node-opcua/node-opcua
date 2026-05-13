import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |OptionSet                                                   |
 * | isAbstract|true                                                        |
 */
export interface DTOptionSet extends DTStructure {
  value: Buffer; // ByteString ns=0;i=15
  validBits: Buffer; // ByteString ns=0;i=15
}
export interface UDTOptionSet extends ExtensionObject, DTOptionSet {};