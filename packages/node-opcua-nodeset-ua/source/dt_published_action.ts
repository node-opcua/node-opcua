import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTActionTarget } from "./dt_action_target.js";
import type { DTDataSetMeta } from "./dt_data_set_meta.js";
import type { DTPublishedDataSetSource } from "./dt_published_data_set_source.js";

// ----- this file has been automatically generated - do not edit

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