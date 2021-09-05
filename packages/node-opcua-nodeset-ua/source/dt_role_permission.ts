// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |RolePermissionType                                |
 * | isAbstract|false                                             |
 */
export interface DTRolePermission extends DTStructure  {
  roleId: NodeId; // NodeId ns=0;i=17
  permissions: UInt32; // UInt32 ns=0;i=94
}