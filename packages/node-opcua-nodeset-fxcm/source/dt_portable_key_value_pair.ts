import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTPortableQualifiedName } from "node-opcua-nodeset-ua/dist/dt_portable_qualified_name.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { VariantOptions } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PortableKeyValuePair                                        |
 * | isAbstract|false                                                       |
 */
export interface DTPortableKeyValuePair extends DTStructure {
  key: DTPortableQualifiedName; // ExtensionObject ns=0;i=24105
  value: VariantOptions; // Variant ns=0;i=24
}
export interface UDTPortableKeyValuePair extends ExtensionObject, DTPortableKeyValuePair {};