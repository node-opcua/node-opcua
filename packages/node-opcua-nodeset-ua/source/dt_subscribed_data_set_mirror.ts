// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTSubscribedDataSet } from "./dt_subscribed_data_set"
import { DTRolePermission } from "./dt_role_permission"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SubscribedDataSetMirrorDataType                   |
 * | isAbstract|false                                             |
 */
export interface DTSubscribedDataSetMirror extends DTSubscribedDataSet {
  parentNodeName: UAString; // String ns=0;i=12
  rolePermissions: DTRolePermission[]; // ExtensionObject ns=0;i=96
}
export interface UDTSubscribedDataSetMirror extends ExtensionObject, DTSubscribedDataSetMirror {};