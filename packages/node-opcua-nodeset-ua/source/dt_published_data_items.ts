import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTPublishedDataSetSource } from "./dt_published_data_set_source";
import type { DTPublishedVariable } from "./dt_published_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedDataItemsDataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedDataItems extends DTPublishedDataSetSource {
  publishedData: DTPublishedVariable[]; // ExtensionObject ns=0;i=14273
}
export interface UDTPublishedDataItems extends ExtensionObject, DTPublishedDataItems {};