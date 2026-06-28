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
import type { NodeId } from "node-opcua-nodeid";
import { sameNodeId } from "node-opcua-nodeid";
import { type IIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";

/**
 * Well-known Roles whose mapping rules a Server shall not allow to be
 * changed (OPC 10000-18 §4.3): Anonymous, AuthenticatedUser and
 * TrustedApplication. (TrustedApplication has no constant in this build and
 * is matched by NodeId when present.)
 */
function isImmutableRole(roleId: NodeId): boolean {
    return sameNodeId(roleId, WellKnownRoleIds.Anonymous) || sameNodeId(roleId, WellKnownRoleIds.AuthenticatedUser);
}

/**
 * Administrative Roles to which weak (Anonymous / AuthenticatedUser) identity
 * rules must not be added (OPC 10000-18 §4.4.5: a Server should refuse to add
 * an ANONYMOUS_5 rule to Roles with administrator privileges).
 */
function isPrivilegedRole(roleId: NodeId): boolean {
    return sameNodeId(roleId, WellKnownRoleIds.SecurityAdmin) || sameNodeId(roleId, WellKnownRoleIds.ConfigureAdmin);
}

/** True for weak criteria that must not be granted to administrative Roles. */
function isWeakCriteria(criteriaType: IdentityCriteriaType): boolean {
    return criteriaType === IdentityCriteriaType.Anonymous || criteriaType === IdentityCriteriaType.AuthenticatedUser;
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
        // 1. The SecureChannel must be encrypted
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;

        // 2. Security check
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        // 3. Extract the rule from input
        const rule = extractIdentityRule(inputArguments);
        if (!rule) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // 4. The parent of this method is the Role object
        const roleNode = this.parent;
        if (!roleNode) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // 5. Well-known immutable Roles cannot be changed
        if (isImmutableRole(roleNode.nodeId)) {
            return { statusCode: StatusCodes.BadRequestNotAllowed };
        }

        // 6. Refuse weak (Anonymous/AuthenticatedUser) rules on administrative Roles
        if (isWeakCriteria(rule.criteriaType) && isPrivilegedRole(roleNode.nodeId)) {
            return { statusCode: StatusCodes.BadRequestNotAllowed };
        }

        // 7. Add to store — duplicate rule is reported as Bad_AlreadyExists
        const added = store.addIdentity(roleNode.nodeId, rule);
        if (!added) {
            return { statusCode: StatusCodes.BadAlreadyExists };
        }

        // 8. Persist
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
        // 1. The SecureChannel must be encrypted
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;

        // 2. Security check
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        // 3. Extract the rule from input
        const rule = extractIdentityRule(inputArguments);
        if (!rule) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // 4. The parent of this method is the Role object
        const roleNode = this.parent;
        if (!roleNode) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // 5. Well-known immutable Roles cannot be changed
        if (isImmutableRole(roleNode.nodeId)) {
            return { statusCode: StatusCodes.BadRequestNotAllowed };
        }

        // 6. Remove from store
        const removed = store.removeIdentity(roleNode.nodeId, rule);
        if (!removed) {
            return { statusCode: StatusCodes.BadNoMatch };
        }

        // 7. Persist
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
