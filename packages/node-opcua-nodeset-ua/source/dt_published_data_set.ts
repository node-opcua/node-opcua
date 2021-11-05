// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTPublishedDataSetSource } from "./dt_published_data_set_source"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PublishedDataSetDataType                          |
 * | isAbstract|false                                             |
 */
export interface DTPublishedDataSet extends DTStructure  {
  name: UAString; // String ns=0;i=12
  dataSetFolder: UAString[]; // String ns=0;i=12
  dataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  extensionFields: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  dataSetSource: DTPublishedDataSetSource; // ExtensionObject ns=0;i=15580
}