import { PermissionType, RolePermissionTypeOptions, WellKnownRoles } from "node-opcua-address-space";
import { makePermissionFlag, allPermissions } from "node-opcua-data-model";

export const rolePermissionRestricted: RolePermissionTypeOptions[] = [
/*
    {
        roleId: WellKnownRoles.Anonymous,
        permissions: PermissionType.Browse,
    },
    {
        roleId: WellKnownRoles.AuthenticatedUser,
        permissions: PermissionType.Browse,
    },
*/
    {
        roleId: WellKnownRoles.ConfigureAdmin,
        permissions: makePermissionFlag("Browse | ReadRolePermissions | Read | ReadHistory | ReceiveEvents")
    },
    {
        roleId: WellKnownRoles.SecurityAdmin,
        permissions: allPermissions
    },
];
export const rolePermissionAdminOnly: RolePermissionTypeOptions[] = [
    {
        roleId: WellKnownRoles.SecurityAdmin,
        permissions: allPermissions
    },
 /*   {
        roleId: WellKnownRoles.Anonymous,
        permissions: PermissionType.Browse
    },
    {
        roleId: WellKnownRoles.AuthenticatedUser,
        permissions: PermissionType.Browse
    }
 */
];
