// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
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
  value: VariantOptions; // Variant ns=0;i=0
}
export interface UDTKeyValue extends ExtensionObject, DTKeyValue {};