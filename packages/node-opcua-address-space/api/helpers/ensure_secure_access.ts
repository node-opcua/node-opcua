import type { BaseNode, IChannelBase, UAMethod, UAObject, UAVariable } from "node-opcua-address-space-base";
import { allPermissions, BrowseDirection, makeAccessRestrictionsFlag, makePermissionFlag, NodeClass } from "node-opcua-data-model";
import { MessageSecurityMode } from "node-opcua-types";
import { WellKnownRoles } from "../session_context.js";

function _isChannelSecure(channel: IChannelBase): boolean {
    if (channel.securityMode === MessageSecurityMode.SignAndEncrypt) {
        return true;
    }
    return false;
}

/**
 * make sure that the given ia node can only be read
 * by Administrator user on a encrypted channel
 * @param node

*/
const adminPermissions = [
    { roleId: WellKnownRoles.SecurityAdmin, permissions: allPermissions },
    { roleId: WellKnownRoles.ConfigureAdmin, permissions: allPermissions },
    { roleId: WellKnownRoles.Supervisor, permissions: allPermissions },
    { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.Engineer, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.Observer, permissions: makePermissionFlag("Browse") }
];
// the structure stays visible to every session: the mandatory children of the
// well-known roles (Identities ...) must be browsable by the anonymous session the
// CTT uses (Base Info Core Structure 001). Values remain readable only by the roles
// above, on a signed and encrypted channel.
const restrictedPermissions = [
    ...adminPermissions,
    { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Browse") }
];
// hideStructure: unauthorised sessions do not even see the nodes
const hiddenPermissions = adminPermissions;

const restrictedAccessFlag = makeAccessRestrictionsFlag("SigningRequired | EncryptionRequired");

export interface EnsureObjectIsSecureOptions {
    /**
     * When true, a session without one of the authorised roles cannot browse the nodes
     * either: the structure itself is hidden. The default (false) leaves the structure
     * browsable by everyone, which is what the OPC UA conformance tests expect of the
     * mandatory children of the well-known roles; only the values are protected.
     */
    hideStructure?: boolean;
}

/**
 * this method install the access right restriction on the given node and its children
 * values will only be available to user with role Administrator or supervisor and
 * with a signed and encrypted channel.
 *
 * @param node the node which permissions are to be adjusted
 * @param options `hideStructure` to also hide the nodes from unauthorised sessions
 */
export function ensureObjectIsSecure(node: BaseNode, options: EnsureObjectIsSecureOptions = {}): void {
    const permissions = options.hideStructure ? hiddenPermissions : restrictedPermissions;
    node.setAccessRestrictions(restrictedAccessFlag);
    if (node.nodeClass === NodeClass.Variable) {
        const variable = node as UAVariable;
        variable.setRolePermissions(permissions);
    }
    if (node.nodeClass === NodeClass.Method) {
        const method = node as UAMethod;
        method.setRolePermissions(permissions);
    }
    if (node.nodeClass === NodeClass.Object) {
        const object = node as UAObject;
        object.setRolePermissions(permissions);
    }
    const children = node.findReferencesExAsObject("Aggregates", BrowseDirection.Forward);
    for (const child of children) {
        ensureObjectIsSecure(child, options);
    }
}
