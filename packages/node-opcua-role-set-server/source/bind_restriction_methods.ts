/**
 * @module node-opcua-role-set-server
 *
 * Method handlers for the RoleType application/endpoint restriction Methods
 * (OPC 10000-18 §4.4.7-10): AddApplication / RemoveApplication / AddEndpoint /
 * RemoveEndpoint, backed by an {@link IRoleRestrictionStore}.
 *
 * All require the SecurityAdmin Role and an encrypted channel, and raise a
 * RoleMappingRuleChangedAuditEventType (§4.5, reusing the same audit hook as the
 * identity Methods).
 */
import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { EndpointCriteria, IRoleRestrictionStore } from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { EndpointType } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { RoleMappingRuleChangedAudit } from "./bind_role_methods.js";
import { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";
import { asString } from "./variant_args.js";

export interface BindRestrictionMethodsOptions {
    restrictionStore: IRoleRestrictionStore;
    /** Called after every successful mutation so the caller can persist / refresh. */
    onMutation?: () => Promise<void>;
    /** Called after an authorized attempt to raise an audit event. */
    onAudit?: (audit: RoleMappingRuleChangedAudit) => void;
}

function endpointFromArg(v: Variant | undefined): EndpointCriteria | null {
    if (!v || !(v.value instanceof EndpointType)) {
        return null;
    }
    const e = v.value;
    return {
        endpointUrl: e.endpointUrl ?? undefined,
        securityMode: e.securityMode,
        securityPolicyUri: e.securityPolicyUri ?? undefined,
        transportProfileUri: e.transportProfileUri ?? undefined
    };
}

/**
 * Build a handler that, after the SecurityAdmin + encrypted-channel checks,
 * applies `mutate` to the Role's restrictions, persists, and audits.
 */
function makeRestrictionHandler(
    options: BindRestrictionMethodsOptions,
    method: RoleMappingRuleChangedAudit["method"],
    mutate: (roleNodeId: NodeId, inputArguments: Variant[]) => StatusCode | null
) {
    const { onMutation, onAudit } = options;
    return async function (this: UAMethod, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const roleNode = this.parent;
        if (!roleNode) {
            return { statusCode: StatusCodes.BadInternalError };
        }
        const statusCode = mutate(roleNode.nodeId, inputArguments);
        if (statusCode === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method,
            roleNodeId: roleNode.nodeId,
            methodNodeId: this.nodeId,
            userName: context.getUserName(),
            inputArguments,
            statusCode
        });
        return { statusCode };
    };
}

/** AddApplication (§4.4.7). */
export function makeAddApplicationHandler(options: BindRestrictionMethodsOptions) {
    return makeRestrictionHandler(options, "AddApplication", (roleNodeId, args) => {
        const uri = asString(args[0]);
        if (uri === null) return null;
        return options.restrictionStore.addApplication(roleNodeId, uri) ? StatusCodes.Good : StatusCodes.BadAlreadyExists;
    });
}

/** RemoveApplication (§4.4.8). */
export function makeRemoveApplicationHandler(options: BindRestrictionMethodsOptions) {
    return makeRestrictionHandler(options, "RemoveApplication", (roleNodeId, args) => {
        const uri = asString(args[0]);
        if (uri === null) return null;
        return options.restrictionStore.removeApplication(roleNodeId, uri) ? StatusCodes.Good : StatusCodes.BadNotFound;
    });
}

/** AddEndpoint (§4.4.9). */
export function makeAddEndpointHandler(options: BindRestrictionMethodsOptions) {
    return makeRestrictionHandler(options, "AddEndpoint", (roleNodeId, args) => {
        const endpoint = endpointFromArg(args[0]);
        if (endpoint === null) return null;
        return options.restrictionStore.addEndpoint(roleNodeId, endpoint) ? StatusCodes.Good : StatusCodes.BadAlreadyExists;
    });
}

/** RemoveEndpoint (§4.4.10). */
export function makeRemoveEndpointHandler(options: BindRestrictionMethodsOptions) {
    return makeRestrictionHandler(options, "RemoveEndpoint", (roleNodeId, args) => {
        const endpoint = endpointFromArg(args[0]);
        if (endpoint === null) return null;
        return options.restrictionStore.removeEndpoint(roleNodeId, endpoint) ? StatusCodes.Good : StatusCodes.BadNotFound;
    });
}
