// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTPublishedAction } from "./dt_published_action"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTActionTarget } from "./dt_action_target"
import { DTActionMethod } from "./dt_action_method"
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