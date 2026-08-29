import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTActionMethod } from "./dt_action_method.js";
import type { DTActionTarget } from "./dt_action_target.js";
import type { DTDataSetMeta } from "./dt_data_set_meta.js";
import type { DTPublishedAction } from "./dt_published_action.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedActionMethodDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedActionMethod extends DTPublishedAction {
  requestDataSetMetaData: DTDataSetMeta; // ExtensionObject ns=0;i=14523
  actionTargets: DTActionTarget[]; // ExtensionObject ns=0;i=18593
  actionMethods: DTActionMethod[]; // ExtensionObject ns=0;i=18597
}
export interface UDTPublishedActionMethod extends ExtensionObject, DTPublishedActionMethod {};