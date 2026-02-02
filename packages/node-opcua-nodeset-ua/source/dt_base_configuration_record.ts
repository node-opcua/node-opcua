// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { DTKeyValuePair } from "./dt_key_value_pair"
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