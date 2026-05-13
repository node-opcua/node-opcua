import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetMeta } from "./dt_data_set_meta";
import type { DTSubscribedDataSet } from "./dt_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |StandaloneSubscribedDataSetDataType                         |
 * | isAbstract|false                                                       |
 */
export interface DTStandaloneSubscribedDataSet extends DTSubscribedDataSet {
  name: UAString; // String ns=0;i=12
  dataSetFolder: UAString[]; // String ns=0;i=12
  dataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  subscribedDataSet?: DTSubscribedDataSet; // ExtensionObject ns=0;i=15630
}
export interface UDTStandaloneSubscribedDataSet extends ExtensionObject, DTStandaloneSubscribedDataSet {};