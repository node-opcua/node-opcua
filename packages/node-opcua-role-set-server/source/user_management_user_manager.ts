/**
 * @module node-opcua-role-set-server
 *
 * Bridges an {@link IUserManagementStore} (and an optional role
 * {@link IIdentityMappingStore}) to the OPC UA server `userManager` interface so
 * that CreateSession / ActivateSession authenticate against the managed users.
 *
 * It also records the StatusCode of the **last authentication** per user — in
 * particular `Good_PasswordChangeRequired` for a user that must change the
 * password (OPC 10000-18 §5.2.8). This is exposed, non-breakingly, through
 * {@link IUserManagementUserManager.lastAuthStatus} so a real-server test (or an
 * application) can observe the activation outcome that the OPC UA stack itself
 * does not surface.
 */

import { WellKnownRoles } from "node-opcua-constants";
import { makeNodeId, type NodeId } from "node-opcua-nodeid";
import type { AnyUserIdentityToken, IIdentityMappingStore, IUserManagementStore } from "node-opcua-role-set-common";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask, UserNameIdentityToken } from "node-opcua-types";

export interface IUserManagementUserManager {
    /** Validate credentials (sync). Returns true for Good and Good_PasswordChangeRequired. */
    isValidUser(this: unknown, userName: string, password: string): boolean;
    /** Resolve the Roles granted to a user (only Anonymous while a change is required). */
    getUserRoles(userName: string): NodeId[];
    /** StatusCode of the last authentication for each user (e.g. Good_PasswordChangeRequired). */
    readonly lastAuthStatus: ReadonlyMap<string, StatusCode>;
}

const has = (mask: number, bit: number): boolean => (mask & bit) === bit;

/**
 * Create a server `userManager` backed by the given user store. Roles are
 * resolved from `identityStore` (a UserName identity rule per user); while a
 * user must change the password, only the Anonymous Role is granted.
 */
export function createUserManagementUserManager(
    userStore: IUserManagementStore,
    identityStore: IIdentityMappingStore
): IUserManagementUserManager {
    const lastAuthStatus = new Map<string, StatusCode>();
    const anonymousOnly = (): NodeId[] => [makeNodeId(WellKnownRoles.Anonymous)];

    return {
        lastAuthStatus,

        isValidUser(_userName: string, _password: string): boolean {
            const result = userStore.authenticate(_userName, _password);
            lastAuthStatus.set(_userName, result.statusCode);
            return result.statusCode === StatusCodes.Good || result.statusCode === StatusCodes.GoodPasswordChangeRequired;
        },

        getUserRoles(userName: string): NodeId[] {
            const user = userStore.getUsers().find((u) => u.userName === userName);
            if (user && has(user.userConfiguration, UserConfigurationMask.MustChangePassword)) {
                return anonymousOnly();
            }
            const token: AnyUserIdentityToken = new UserNameIdentityToken({ userName });
            return identityStore.resolveRoles(token);
        }
    };
}
