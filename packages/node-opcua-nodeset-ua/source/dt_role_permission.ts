import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |RolePermissionType                                          |
 * | isAbstract|false                                                       |
 */
export interface DTRolePermission extends DTStructure {
  roleId: NodeId; // NodeId ns=0;i=17
  permissions: UInt32; // UInt32 ns=0;i=94
}
export interface UDTRolePermission extends ExtensionObject, DTRolePermission {};