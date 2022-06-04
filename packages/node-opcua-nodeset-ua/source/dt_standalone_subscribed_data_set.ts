// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTSubscribedDataSet } from "./dt_subscribed_data_set"
import { DTDataSetMeta } from "./dt_data_set_meta"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |StandaloneSubscribedDataSetDataType               |
 * | isAbstract|false                                             |
 */
export interface DTStandaloneSubscribedDataSet extends DTSubscribedDataSet  {
  name: UAString; // String ns=0;i=12
  dataSetFolder: UAString[]; // String ns=0;i=12
  dataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  subscribedDataSet: DTSubscribedDataSet; // ExtensionObject ns=0;i=15630
}