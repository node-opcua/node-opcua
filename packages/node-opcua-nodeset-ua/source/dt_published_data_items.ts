// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTPublishedDataSetSource } from "./dt_published_data_set_source"
import { DTPublishedVariable } from "./dt_published_variable"
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