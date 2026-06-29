/**
 * @module node-opcua-role-set-server
 *
 * Browse / channel hardening for the security-sensitive RoleSet & User
 * Management nodes (OPC 10000-18 §4.4.1 / §5), built entirely on the two
 * mechanisms the address space already enforces — no custom Browse filter or
 * read hook:
 *
 *  - **RolePermissions** — a node that carries RolePermissions grants *nothing*
 *    to a Role that is not listed. Restricting a node to `SecurityAdmin` both
 *    hides it from a non-admin's Browse (`isBrowseAccessRestricted`) and denies
 *    Read/Call (`Bad_UserAccessDenied`).
 *  - **AccessRestrictions(EncryptionRequired)** — the node may only be
 *    read/called over a `SignAndEncrypt` channel, otherwise the core returns
 *    `Bad_SecurityModeInsufficient`, so identity/user data never leaves the
 *    server over an unencrypted channel.
 *
 * Both checks run in the core (`ua_variable_impl` / `ua_method_impl`) *before*
 * the bound Method handler, so the per-Method `checkSecurityAdminAccess` /
 * `checkEncryptedChannel` guards become defense-in-depth rather than the only
 * line of defense.
 */
import type { BaseNode } from "node-opcua-address-space";
import { AccessRestrictionsFlag, allPermissions } from "node-opcua-data-model";
import { WellKnownRoleIds } from "node-opcua-role-set-common";

/**
 * Restrict a node to the `SecurityAdmin` Role, reachable only over an encrypted
 * channel — used for the admin-only configuration Methods and the sensitive
 * identity/restriction/user Properties.
 */
export function hardenAdminOnly(node: BaseNode | null | undefined): void {
    if (!node) return;
    node.setRolePermissions([{ roleId: WellKnownRoleIds.SecurityAdmin, permissions: allPermissions }]);
    node.setAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired);
}

/**
 * Require an encrypted channel for a node that must stay visible/callable to
 * ordinary authenticated users (e.g. `ChangePassword`, §5.2.8) — no Role
 * restriction, just `EncryptionRequired`.
 */
export function hardenEncryptedOnly(node: BaseNode | null | undefined): void {
    if (!node) return;
    node.setAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired);
}
