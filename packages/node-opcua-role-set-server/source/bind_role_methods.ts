/**
 * @module node-opcua-role-set-server
 *
 * Method handlers for RoleType AddIdentity / RemoveIdentity
 * and RoleSetType AddRole / RemoveRole.
 *
 * Each handler follows the OPC UA method binding pattern:
 *   - `this` is the UAMethod node
 *   - `inputArguments` is Variant[]
 *   - `context` is ISessionContext
 *   - returns Promise<CallMethodResultOptions>
 */
import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import { sameNodeId } from "node-opcua-nodeid";
import { type IIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityMappingRuleType } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

/**
 * Verify the calling session holds the SecurityAdmin role.
 * @returns StatusCodes.Good if authorized, BadUserAccessDenied otherwise.
 */
function checkSecurityAdminAccess(context: ISessionContext): CallMethodResultOptions | null {
    const roles = context.getCurrentUserRoles();
    const hasSecurityAdmin = roles.some((r) => sameNodeId(r, WellKnownRoleIds.SecurityAdmin));
    if (!hasSecurityAdmin) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }
    return null; // authorized
}

/**
 * Extract the IdentityMappingRuleType from the first input argument.
 */
function extractIdentityRule(inputArguments: Variant[]): IdentityMappingRuleType | null {
    if (!inputArguments || inputArguments.length < 1) {
        return null;
    }
    const value = inputArguments[0].value;
    if (value instanceof IdentityMappingRuleType) {
        return value;
    }
    return null;
}

export interface BindRoleMethodsOptions {
    store: IIdentityMappingStore;
    /** Called after every mutation (add/remove) so the caller can persist. */
    onMutation?: () => Promise<void>;
}

/**
 * Create an AddIdentity method handler bound to the given store.
 * The handler extracts the role NodeId from its parent Role object.
 */
export function makeAddIdentityHandler(options: BindRoleMethodsOptions) {
    const { store, onMutation } = options;

    return async function _addIdentity(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        // 1. Security check
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        // 2. Extract the rule from input
        const rule = extractIdentityRule(inputArguments);
        if (!rule) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // 3. The parent of this method is the Role object
        const roleNode = this.parent;
        if (!roleNode) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // 4. Add to store
        store.addIdentity(roleNode.nodeId, rule);

        // 5. Persist
        if (onMutation) {
            await onMutation();
        }

        return { statusCode: StatusCodes.Good };
    };
}

/**
 * Create a RemoveIdentity method handler bound to the given store.
 */
export function makeRemoveIdentityHandler(options: BindRoleMethodsOptions) {
    const { store, onMutation } = options;

    return async function _removeIdentity(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        // 1. Security check
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        // 2. Extract the rule from input
        const rule = extractIdentityRule(inputArguments);
        if (!rule) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // 3. The parent of this method is the Role object
        const roleNode = this.parent;
        if (!roleNode) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // 4. Remove from store
        const removed = store.removeIdentity(roleNode.nodeId, rule);
        if (!removed) {
            return { statusCode: StatusCodes.BadNoMatch };
        }

        // 5. Persist
        if (onMutation) {
            await onMutation();
        }

        return { statusCode: StatusCodes.Good };
    };
}

/**
 * Handler for RoleSetType.AddRole — not implemented (custom roles).
 */
export async function addRoleNotImplemented(
    this: UAMethod,
    _inputArguments: Variant[],
    _context: ISessionContext
): Promise<CallMethodResultOptions> {
    return { statusCode: StatusCodes.BadNotImplemented };
}

/**
 * Handler for RoleSetType.RemoveRole — not implemented (custom roles).
 */
export async function removeRoleNotImplemented(
    this: UAMethod,
    _inputArguments: Variant[],
    _context: ISessionContext
): Promise<CallMethodResultOptions> {
    return { statusCode: StatusCodes.BadNotImplemented };
}
