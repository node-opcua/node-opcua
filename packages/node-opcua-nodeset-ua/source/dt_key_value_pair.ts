// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |KeyValuePair                                      |
 * | isAbstract|false                                             |
 */
export interface DTKeyValuePair extends DTStructure {
  key: QualifiedName; // QualifiedName ns=0;i=20
  value: VariantOptions; // Variant ns=0;i=0
}
export interface UDTKeyValuePair extends ExtensionObject, DTKeyValuePair {};