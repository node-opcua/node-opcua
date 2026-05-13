import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTSubscribedDataSet } from "./dt_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |StandaloneSubscribedDataSetRefDataType                      |
 * | isAbstract|false                                                       |
 */
export interface DTStandaloneSubscribedDataSetRef extends DTSubscribedDataSet {
  dataSetName: UAString; // String ns=0;i=12
}
export interface UDTStandaloneSubscribedDataSetRef extends ExtensionObject, DTStandaloneSubscribedDataSetRef {};