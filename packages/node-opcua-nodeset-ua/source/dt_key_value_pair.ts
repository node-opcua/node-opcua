import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |KeyValuePair                                                |
 * | isAbstract|false                                                       |
 */
export interface DTKeyValuePair extends DTStructure {
  key: QualifiedName; // QualifiedName ns=0;i=20
  value: Variant; // Variant ns=0;i=24
}
export interface UDTKeyValuePair extends ExtensionObject, DTKeyValuePair {};