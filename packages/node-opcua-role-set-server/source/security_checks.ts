/**
 * @module node-opcua-role-set-server
 *
 * Shared authorization checks for the RoleType and UserManagement Methods
 * (OPC 10000-18 §4.4 / §5.2): all require the SecurityAdmin Role and an
 * encrypted SecureChannel.
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import { sameNodeId } from "node-opcua-nodeid";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";

/**
 * Verify the calling session holds the SecurityAdmin role.
 * @returns a `Bad_UserAccessDenied` denial, or `null` if authorized.
 */
export function checkSecurityAdminAccess(context: ISessionContext): CallMethodResultOptions | null {
    const roles = context.getCurrentUserRoles();
    const hasSecurityAdmin = roles.some((r) => sameNodeId(r, WellKnownRoleIds.SecurityAdmin));
    if (!hasSecurityAdmin) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }
    return null;
}

/**
 * Verify the call arrives over an encrypted (SignAndEncrypt) SecureChannel
 * (OPC 10000-18 — `Bad_SecurityModeInsufficient`).
 *
 * When the channel security mode cannot be determined (e.g. an in-process
 * `PseudoSession` with no channel), the check is skipped — such sessions are
 * inherently local/trusted. Remote sessions always expose a channel mode.
 *
 * @returns a denial result, or `null` if the channel is acceptable.
 */
export function checkEncryptedChannel(context: ISessionContext): CallMethodResultOptions | null {
    const securityMode = context.session?.channel?.securityMode;
    if (securityMode === undefined) {
        return null; // mode unknown (in-process) → cannot enforce
    }
    if (securityMode !== MessageSecurityMode.SignAndEncrypt) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    return null;
}
