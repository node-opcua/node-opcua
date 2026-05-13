import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";
import type { Variant } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * This structure is similar to 0:KeyValuePair which
 * uses 0:TrimmedString instead of 0:QualifiedName.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |KeyValueDataType                                            |
 * | isAbstract|false                                                       |
 */
export interface DTKeyValue extends DTStructure {
  /** It is the unique key of the value.*/
  key: UAString; // String ns=0;i=31918
  /** It is the value associated with the key.*/
  value: Variant; // Variant ns=0;i=24
}
export interface UDTKeyValue extends ExtensionObject, DTKeyValue {};