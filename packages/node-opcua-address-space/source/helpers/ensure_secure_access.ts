import { NodeClass } from "node-opcua-data-model";
import { MessageSecurityMode } from "node-opcua-types";
import { BaseNode, UAVariable, UAMethod, Permission } from "../address_space_ts";
import { IChannelBase, SessionContext, WellKnownRoles } from "../session_context";

function isChannelSecure(channel: IChannelBase): boolean {
    if (channel.securityMode === MessageSecurityMode.SignAndEncrypt) {
        return true;
    }
    return false;
}

function newIsUserReadable(this: BaseNode, context: SessionContext): boolean {
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
function replaceMethod(obj: any, method: string, func: any) {
    const oldMethod = obj[method];
    if (!oldMethod) {
        throw new Error("Icannot find method " + method + " on object " + obj.browseName.toString());
    }
    obj[method] = function (this: any, ...args: any[]) {
        const ret = func.apply(this, args);
        if (!ret) {
            return false;
        }
        return oldMethod.apply(this, args);
    };
}
/**
 * make sure that the given ia node can only be read
 * by Admistrrator user on a encrypted channel
 * @param node

*/
const priviledgedRoles =   ["!*", WellKnownRoles.SecurityAdmin, WellKnownRoles.ConfigureAdmin, WellKnownRoles.Supervisor];

export function ensureObjectIsSecure(node: BaseNode) {

    if (node.nodeClass === NodeClass.Variable) {
        replaceMethod(node, "isUserReadable", newIsUserReadable);
        const variable = node as UAVariable;
        variable.setPermissions({
            [Permission.Read]:        priviledgedRoles,
            [Permission.Write]:       ["!*"],
            [Permission.ReadHistory]: priviledgedRoles,
            [Permission.Browse]:      priviledgedRoles,
        });
    }
    if (node.nodeClass === NodeClass.Method) {
        const variable = node as UAMethod;
        variable.setPermissions({
            [Permission.Call]:        priviledgedRoles,
        });
    }
    const children = node.findReferencesAsObject("Aggregates", true);
    for (const child of children) {
        ensureObjectIsSecure(child);
    }
}
