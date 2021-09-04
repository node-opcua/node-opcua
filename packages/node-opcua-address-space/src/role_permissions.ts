import { RolePermissionType, RolePermissionTypeOptions } from "node-opcua-types";

export function coerceRolePermissions(rolePermissions: RolePermissionTypeOptions[] | undefined): RolePermissionType[] | undefined {
    if (!rolePermissions) return undefined;
    return rolePermissions.map((rp) => new RolePermissionType(rp));
}
