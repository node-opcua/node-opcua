import { PermissionType, type RolePermissionTypeOptions, WellKnownRoles } from "node-opcua-address-space";
import { allPermissions, makePermissionFlag } from "node-opcua-data-model";

export const rolePermissionRestricted: RolePermissionTypeOptions[] = [
    {
        roleId: WellKnownRoles.Anonymous,
        permissions: PermissionType.Browse
    },
    {
        roleId: WellKnownRoles.AuthenticatedUser,
        permissions: PermissionType.Browse
    },
    {
        roleId: WellKnownRoles.ConfigureAdmin,
        permissions: makePermissionFlag("Browse | ReadRolePermissions | Read | ReadHistory | ReceiveEvents")
    },
    {
        roleId: WellKnownRoles.SecurityAdmin,
        permissions: allPermissions
    }
];
export const rolePermissionAdminOnly: RolePermissionTypeOptions[] = [
    {
        roleId: WellKnownRoles.SecurityAdmin,
        permissions: allPermissions
    }
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
