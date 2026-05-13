import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |BaseConfigurationRecordDataType                             |
 * | isAbstract|true                                                        |
 */
export interface DTBaseConfigurationRecord extends DTStructure {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTBaseConfigurationRecord extends ExtensionObject, DTBaseConfigurationRecord {};