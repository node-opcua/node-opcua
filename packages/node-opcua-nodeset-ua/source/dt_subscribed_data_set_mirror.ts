import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTRolePermission } from "./dt_role_permission";
import type { DTSubscribedDataSet } from "./dt_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SubscribedDataSetMirrorDataType                             |
 * | isAbstract|false                                                       |
 */
export interface DTSubscribedDataSetMirror extends DTSubscribedDataSet {
  parentNodeName: UAString; // String ns=0;i=12
  rolePermissions: DTRolePermission[]; // ExtensionObject ns=0;i=96
}
export interface UDTSubscribedDataSetMirror extends ExtensionObject, DTSubscribedDataSetMirror {};