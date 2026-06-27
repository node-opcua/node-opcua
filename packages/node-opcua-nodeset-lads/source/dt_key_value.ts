import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * A key-value pair similar to 0:KeyValuePair which
 * uses 0:String instead of 0:Qualifiedname for easu
 * of use.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/LADS/                           |
 * | nodeClass |DataType                                                    |
 * | name      |KeyValueType                                                |
 * | isAbstract|false                                                       |
 */
export interface DTKeyValue extends DTStructure {
  /** Unique key to identify a value.*/
  key: UAString; // String ns=0;i=12
  /** The value associated with the key.*/
  value: UAString; // String ns=0;i=12
}
export interface UDTKeyValue extends ExtensionObject, DTKeyValue {};