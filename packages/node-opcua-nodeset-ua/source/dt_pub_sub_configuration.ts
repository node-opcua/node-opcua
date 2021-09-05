// ----- this file has been automatically generated - do not edit
import { DTStructure } from "./dt_structure"
import { DTPublishedDataSet } from "./dt_published_data_set"
import { DTPubSubConnection } from "./dt_pub_sub_connection"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubConfigurationDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTPubSubConfiguration extends DTStructure  {
  publishedDataSets: DTPublishedDataSet[]; // ExtensionObject ns=0;i=15578
  connections: DTPubSubConnection[]; // ExtensionObject ns=0;i=15617
  enabled: boolean; // Boolean ns=0;i=1
}