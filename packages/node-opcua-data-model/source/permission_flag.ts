/**
 * @module node-opcua-data-model
 */
import { _make_flag } from "./_make_flag";

/**
 * https://reference.opcfoundation.org/v104/Core/docs/Part3/8.55/
 */

// same as PermissionType in node-opcua-types
export enum PermissionFlag {
    None = 0,

    /**
     * The Client is allowed to see the references to and from the Node.
     * This implies that the Client is able to Read to Attributes other than the Value or the RolePermissions Attribute.
     * This Permission is valid for all NodeClasses.
     */
    Browse = 1,

    /**
     * The Client is allowed to read the RolePermissions Attribute.
     * This Permission is valid for all NodeClasses.
     */
    ReadRolePermissions = 2,
    /**
     * The Client is allowed to write to Attributes other than the Value,
     * Historizing or RolePermissions Attribute if the WriteMask indicates that
     * the Attribute is writeable.
     * This bit affects the value of a UserWriteMask Attribute.
     * This Permission is valid for all NodeClasses.
     */
    WriteAttribute = 4,
    /**
     * The Client is allowed to write to the RolePermissions Attribute if the WriteMask
     * indicates that the Attribute is writeable.
     * This bit affects the value of the UserWriteMask Attribute.
     * This Permission is valid for all NodeClasses.
     */
    WriteRolePermissions = 8,
    /**
     * The Client is allowed to write to the Historizing Attributes if the WriteMask indicates that the Attribute is writeable.
     * This bit affects the value of the UserWriteMask Attribute.
     * This Permission is only valid for Variables.
     */
    WriteHistorizing = 16,
    /**
     * The Client is allowed to read the Value Attribute.
     * This bit affects the CurrentRead bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables.
     */
    Read = 32,
    /**
     * The Client is allowed to write the Value Attribute.
     * This bit affects the CurrentWrite bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables.
     */
    Write = 64,
    /**
     * The Client is allowed to read the history associated with a Node.
     * This bit affects the HistoryRead bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables, Objects or Views.
     */
    ReadHistory = 128,
    /**
     * The Client is allowed to insert the history associated with a Node.
     * This bit affects the HistoryWrite bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables, Objects or Views.
     */
    InsertHistory = 256,
    /**
     * The Client is allowed to modify the history associated with a Node.
     * This bit affects the HistoryWrite bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables, Objects or Views.
     */
    ModifyHistory = 512,
    /**
     * The Client is allowed to delete the history associated with a Node.
     * This bit affects the HistoryWrite bit of the UserAccessLevel Attribute.
     * This Permission is only valid for Variables, Objects or Views.
     */
    DeleteHistory = 1024,
    /**
     * A Client only receives an Event if this bit is set on the Node identified
     * by the EventTypeId field and on the Node identified by the SourceNode field.
     * This Permission is only valid for EventType Nodes or SourceNodes.
     */
    ReceiveEvents = 2048,
    /**
     * The Client is allowed to call the Method if this bit is set on the Object or
     * ObjectType Node passed in the Call request and the Method Instance associated
     * with that Object or ObjectType.
     * This bit affects the UserExecutable Attribute when set on Method Node.
     * This Permission is only valid for Objects, ObjectType or Methods.
     */
    Call = 4096,
    /**
     * 	The Client is allowed to add references to the Node.
     * This Permission is valid for all NodeClasses.
     */
    AddReference = 8192,
    /**
     * The Client is allowed to remove references from the Node.
     * This Permission is valid for all NodeClasses.
     */
    RemoveReference = 16384,
    /**
     * The Client is allowed to delete the Node.
     * This Permission is valid for all NodeClasses.
     */
    DeleteNode = 32768,
    /**
     * The Client is allowed to add Nodes to the Namespace.
     * This Permission is only used in the DefaultRolePermissions and
     * DefaultUserRolePermissions Properties of a NamespaceMetadata Object
     */
    AddNode = 65536
}

export const allPermissions =
    PermissionFlag.Browse |
    PermissionFlag.Browse |
    PermissionFlag.ReadRolePermissions |
    PermissionFlag.WriteAttribute |
    PermissionFlag.WriteRolePermissions |
    PermissionFlag.WriteHistorizing |
    PermissionFlag.Read |
    PermissionFlag.Write |
    PermissionFlag.ReadHistory |
    PermissionFlag.InsertHistory |
    PermissionFlag.ModifyHistory |
    PermissionFlag.DeleteHistory |
    PermissionFlag.ReceiveEvents |
    PermissionFlag.Call |
    PermissionFlag.AddReference |
    PermissionFlag.RemoveReference |
    PermissionFlag.DeleteNode |
    PermissionFlag.AddNode;

// @example
//      makePermissionFlag("ReceiveEvents | RemoveReference");
export function makePermissionFlag(str: string | number | null): number {
    if (str === "All") {
        return allPermissions;
    }
    return _make_flag(str, PermissionFlag.None, PermissionFlag) as PermissionFlag;
}

export function permissionFlagToString(permissionFlag: PermissionFlag): string {
    const retVal = [];
    for (const [key, value] of Object.entries(PermissionFlag)) {
        const numKey = parseInt(key, 10);
        if (numKey.toString() !== key || numKey === 0) {
            continue;
        }
        if ((permissionFlag & numKey) === numKey) {
            retVal.push(value);
        }
    }
    if (retVal.length === 0) {
        retVal.push("None");
    }
    return retVal.join(" | ");
}
