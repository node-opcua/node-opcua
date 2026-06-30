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
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
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

/**
 * Details of an identity-mapping change, passed to {@link BindRoleMethodsOptions.onAudit}
 * so the caller can raise a `RoleMappingRuleChangedAuditEventType` (OPC 10000-18 §4.5).
 * Raised for every authorized attempt — both successful updates and refusals
 * (e.g. immutable Role, duplicate) — with the resulting `statusCode`.
 */
export interface RoleMappingRuleChangedAudit {
    method: "AddIdentity" | "RemoveIdentity" | "AddApplication" | "RemoveApplication" | "AddEndpoint" | "RemoveEndpoint";
    roleNodeId: NodeId;
    methodNodeId: NodeId;
    userName: string;
    inputArguments: Variant[];
    statusCode: StatusCode;
}

export interface BindRoleMethodsOptions {
    store: IIdentityMappingStore;
    /** Called after every mutation (add/remove) so the caller can persist. */
    onMutation?: () => Promise<void>;
    /** Called after an authorized AddIdentity/RemoveIdentity attempt to raise an audit event. */
    onAudit?: (audit: RoleMappingRuleChangedAudit) => void;
}

/**
 * Create an AddIdentity method handler bound to the given store.
 * The handler extracts the role NodeId from its parent Role object.
 */
export function makeAddIdentityHandler(options: BindRoleMethodsOptions) {
    const { store, onMutation, onAudit } = options;

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

        // 5-7. Compute the outcome of the authorized rule-change attempt
        let statusCode: StatusCode;
        if (isImmutableRole(roleNode.nodeId)) {
            // well-known immutable Roles cannot be changed (§4.3)
            statusCode = StatusCodes.BadRequestNotAllowed;
        } else if (isWeakCriteria(rule.criteriaType) && isPrivilegedRole(roleNode.nodeId)) {
            // refuse weak (Anonymous/AuthenticatedUser) rules on administrative Roles (§4.4.5)
            statusCode = StatusCodes.BadRequestNotAllowed;
        } else {
            // duplicate rule is reported as Bad_AlreadyExists
            statusCode = store.addIdentity(roleNode.nodeId, rule) ? StatusCodes.Good : StatusCodes.BadAlreadyExists;
        }

        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "AddIdentity",
            roleNodeId: roleNode.nodeId,
            methodNodeId: this.nodeId,
            userName: context.getUserName(),
            inputArguments,
            statusCode
        });
        return { statusCode };
    };
}

/**
 * Create a RemoveIdentity method handler bound to the given store.
 */
export function makeRemoveIdentityHandler(options: BindRoleMethodsOptions) {
    const { store, onMutation, onAudit } = options;

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

        // 5-6. Compute the outcome of the authorized rule-change attempt
        let statusCode: StatusCode;
        if (isImmutableRole(roleNode.nodeId)) {
            statusCode = StatusCodes.BadRequestNotAllowed;
        } else {
            statusCode = store.removeIdentity(roleNode.nodeId, rule) ? StatusCodes.Good : StatusCodes.BadNoMatch;
        }

        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "RemoveIdentity",
            roleNodeId: roleNode.nodeId,
            methodNodeId: this.nodeId,
            userName: context.getUserName(),
            inputArguments,
            statusCode
        });
        return { statusCode };
    };
}
