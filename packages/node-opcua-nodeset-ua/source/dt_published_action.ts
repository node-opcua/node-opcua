// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTPublishedDataSetSource } from "./dt_published_data_set_source"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTActionTarget } from "./dt_action_target"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedActionDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedAction extends DTPublishedDataSetSource {
  requestDataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  actionTargets: DTActionTarget[]; // ExtensionObject ns=0;i=18593
}
export interface UDTPublishedAction extends ExtensionObject, DTPublishedAction {};