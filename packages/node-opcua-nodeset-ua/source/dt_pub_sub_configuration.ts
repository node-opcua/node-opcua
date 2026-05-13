import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTPubSubConnection } from "./dt_pub_sub_connection";
import type { DTPublishedDataSet } from "./dt_published_data_set";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConfigurationDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConfiguration extends DTStructure {
  publishedDataSets: DTPublishedDataSet[]; // ExtensionObject ns=0;i=15578
  connections: DTPubSubConnection[]; // ExtensionObject ns=0;i=15617
  enabled: boolean; // Boolean ns=0;i=1
}
export interface UDTPubSubConfiguration extends ExtensionObject, DTPubSubConfiguration {};