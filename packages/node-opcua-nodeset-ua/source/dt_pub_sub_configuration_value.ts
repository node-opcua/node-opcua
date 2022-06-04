// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTPubSubConfigurationRef } from "./dt_pub_sub_configuration_ref"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubConfigurationValueDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTPubSubConfigurationValue extends DTStructure  {
  configurationElement: DTPubSubConfigurationRef; // ExtensionObject ns=0;i=25519
  name: UAString; // String ns=0;i=12
  identifier: undefined; // Null ns=0;i=0
}