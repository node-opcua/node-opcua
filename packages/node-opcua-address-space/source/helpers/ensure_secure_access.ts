import { allPermissions, BrowseDirection, makeAccessRestrictionsFlag, makePermissionFlag, NodeClass } from "node-opcua-data-model";
import { MessageSecurityMode } from "node-opcua-types";
import { BaseNode, UAVariable, UAMethod, UAObject, ISessionContext, IChannelBase } from "node-opcua-address-space-base";
import { WellKnownRoles } from "../session_context";

function isChannelSecure(channel: IChannelBase): boolean {
    if (channel.securityMode === MessageSecurityMode.SignAndEncrypt) {
        return true;
    }
    return false;
}

function newIsUserReadable(this: BaseNode, context: ISessionContext): boolean {
    if (context) {
        if (!context.session) {
            // console.log(" context has no session", context);
            return false;
        }
        if (!context.session.channel) {
            // console.log(" context has no channel", context);
            return false;
        }
        if (!isChannelSecure(context.session.channel)) {
            return false;
        }
        return true;
    }
    return false;
}

/**
 * make sure that the given ia node can only be read
 * by Administrator user on a encrypted channel
 * @param node

*/
const restrictedPermissions = [
    { roleId: WellKnownRoles.SecurityAdmin, permissions: allPermissions },
    { roleId: WellKnownRoles.ConfigureAdmin, permissions: allPermissions },
    { roleId: WellKnownRoles.Supervisor, permissions: allPermissions },
    { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.Engineer, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.Observer, permissions: makePermissionFlag("Browse") }
    /*
    { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Browse") },
    { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Browse") },
*/
];
const restrictedAccessFlag = makeAccessRestrictionsFlag("SigningRequired | EncryptionRequired");
/**
 * this method install the access right restriction on the given node and its children
 * values will only be available to user with role Administrator or supervisor and
 * with a signed and encrypted channel.
 *
 * @param node the node which permissions are to be adjusted
 */
export function ensureObjectIsSecure(node: BaseNode): void {
    node.setAccessRestrictions(restrictedAccessFlag);
    if (node.nodeClass === NodeClass.Variable) {
        // replaceMethod(node, "isUserReadable", newIsUserReadable);
        const variable = node as UAVariable;
        variable.setRolePermissions(restrictedPermissions);
    }
    if (node.nodeClass === NodeClass.Method) {
        const method = node as UAMethod;
        method.setRolePermissions(restrictedPermissions);
    }
    if (node.nodeClass === NodeClass.Object) {
        const object = node as UAObject;
        object.setRolePermissions(restrictedPermissions);
    }
    const children = node.findReferencesExAsObject("Aggregates", BrowseDirection.Forward);
    for (const child of children) {
        ensureObjectIsSecure(child);
    }
}
