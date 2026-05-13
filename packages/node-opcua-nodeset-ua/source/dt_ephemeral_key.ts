import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EphemeralKeyType                                            |
 * | isAbstract|false                                                       |
 */
export interface DTEphemeralKey extends DTStructure {
  publicKey: Buffer; // ByteString ns=0;i=15
  signature: Buffer; // ByteString ns=0;i=15
}
export interface UDTEphemeralKey extends ExtensionObject, DTEphemeralKey {};