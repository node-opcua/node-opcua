import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTPublishedDataSetSource } from "./dt_published_data_set_source";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedDataSetCustomSourceDataType                        |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedDataSetCustomSource extends DTPublishedDataSetSource {
  cyclicDataSet: boolean; // Boolean ns=0;i=1
}
export interface UDTPublishedDataSetCustomSource extends ExtensionObject, DTPublishedDataSetCustomSource {};