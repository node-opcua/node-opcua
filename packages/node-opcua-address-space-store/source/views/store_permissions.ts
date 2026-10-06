/**
 * @module node-opcua-address-space-store
 *
 * What a session may do with a node of the store: the same rules as SessionContext applies to
 * node objects (access restrictions against the channel's security mode, role permissions
 * against the session's roles, the namespace defaults when the node declares neither), read
 * from the columns instead of the node.
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import { WellKnownRoles } from "node-opcua-constants";
import { AccessLevelFlag, AccessRestrictionsFlag, PermissionFlag } from "node-opcua-data-model";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import type { RolePermissionEntry } from "../node_store.js";
import { ValueKind } from "../value_store.js";
import type { StoreAddressSpace } from "./store_address_space.js";

export type UnresolvedPermissionPolicy = "allow" | "deny";

/** what a namespace grants to the nodes that declare nothing themselves */
export interface NamespacePermissionDefaults {
    accessRestrictions: AccessRestrictionsFlag;
    /** null: no policy at all, the unresolved permission policy decides */
    rolePermissions: readonly RolePermissionEntry[] | null;
}

const NO_DEFAULTS: NamespacePermissionDefaults = { accessRestrictions: AccessRestrictionsFlag.None, rolePermissions: null };

const allPermissions: PermissionFlag =
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

const anonymousRole = resolveNodeId(WellKnownRoles.Anonymous);
const SERVER_NAMESPACES = resolveNodeId("ns=0;i=11715");

/** the metadata nodes of a namespace, found once; their value versions tell when to re-read */
interface NamespaceMetadata {
    restrictions: number;
    rolePermissions: number;
    userRolePermissions: number;
    versions: [number, number, number];
    defaults: NamespacePermissionDefaults;
}

export class StorePermissions {
    readonly #space: StoreAddressSpace;
    #policy: UnresolvedPermissionPolicy;
    // the defaults the application set, by namespace index; they win over the metadata nodes
    readonly #explicit = new Map<number, NamespacePermissionDefaults>();
    readonly #metadata = new Map<number, NamespaceMetadata | null>();

    constructor(space: StoreAddressSpace, policy: UnresolvedPermissionPolicy = "allow") {
        this.#space = space;
        this.#policy = policy;
    }

    public get unresolvedPermissionPolicy(): UnresolvedPermissionPolicy {
        return this.#policy;
    }
    public set unresolvedPermissionPolicy(policy: UnresolvedPermissionPolicy) {
        this.#policy = policy;
    }

    /**
     * the defaults of a namespace as the application sets them: what its NamespaceMetadata
     * object does not say (the standard nodesets declare the properties without a value), as
     * Namespace.setDefaultAccessRestrictions() and setDefaultRolePermissions() do today
     */
    public setNamespaceDefaults(namespaceIndex: number, defaults: NamespacePermissionDefaults | null): void {
        if (defaults) this.#explicit.set(namespaceIndex, defaults);
        else this.#explicit.delete(namespaceIndex);
        this.invalidate();
    }

    /** forget the metadata nodes found so far: after nodes were added or removed */
    public invalidate(): void {
        if (this.#metadata.size !== 0) this.#metadata.clear();
    }

    /**
     * the status a Read of the Value of node `index` gets from `context`: Good, or the status
     * that denies it, in the order the node objects apply them
     */
    public readValueStatus(context: ISessionContext | null | undefined, index: number): number {
        const nodes = this.#space.store.nodes;
        const session = context?.session;
        if (session && this.isAccessRestricted(context, index)) {
            return StatusCodes.BadSecurityModeInsufficient.value;
        }
        if ((nodes.accessLevel(index) & AccessLevelFlag.CurrentRead) === 0) {
            return StatusCodes.BadNotReadable.value;
        }
        if (session && (this.permissions(context, index) & PermissionFlag.Read) === 0) {
            return StatusCodes.BadUserAccessDenied.value;
        }
        if ((nodes.userAccessLevel(index) & AccessLevelFlag.CurrentRead) === 0) {
            return StatusCodes.BadNotReadable.value;
        }
        return StatusCodes.Good.value;
    }

    /** the status a Write of the Value of node `index` gets from `context`: Good, or what denies it */
    public writeValueStatus(context: ISessionContext | null | undefined, index: number): number {
        const nodes = this.#space.store.nodes;
        const session = context?.session;
        if (session && this.isAccessRestricted(context, index)) {
            return StatusCodes.BadSecurityModeInsufficient.value;
        }
        if ((nodes.accessLevel(index) & AccessLevelFlag.CurrentWrite) === 0) {
            return StatusCodes.BadNotWritable.value;
        }
        if (session && (this.permissions(context, index) & PermissionFlag.Write) === 0) {
            return StatusCodes.BadUserAccessDenied.value;
        }
        if ((nodes.userAccessLevel(index) & AccessLevelFlag.CurrentWrite) === 0) {
            return StatusCodes.BadNotWritable.value;
        }
        return StatusCodes.Good.value;
    }

    /** true when the context may see the node in a Browse: the Browse permission; every in-process caller */
    public canBrowse(context: ISessionContext | null | undefined, index: number): boolean {
        if (!context?.session) {
            return true;
        }
        return (this.permissions(context, index) & PermissionFlag.Browse) !== 0;
    }

    /** true when the channel the context came over does not meet the node's access restrictions */
    public isAccessRestricted(context: ISessionContext | null | undefined, index: number): boolean {
        const session = context?.session;
        if (!session) {
            // an in-process caller: nothing to restrict against
            return false;
        }
        const restrictions = this.accessRestrictions(index);
        if (restrictions === AccessRestrictionsFlag.None) {
            return false;
        }
        const securityMode = session.channel?.securityMode;
        if (restrictions & AccessRestrictionsFlag.SigningRequired) {
            if (securityMode !== MessageSecurityMode.Sign && securityMode !== MessageSecurityMode.SignAndEncrypt) {
                return true;
            }
        }
        if (restrictions & AccessRestrictionsFlag.EncryptionRequired) {
            if (securityMode !== MessageSecurityMode.SignAndEncrypt) {
                return true;
            }
        }
        return false;
    }

    /** the node's own AccessRestrictions, else its namespace's */
    public accessRestrictions(index: number): AccessRestrictionsFlag {
        const nodes = this.#space.store.nodes;
        const own = nodes.accessRestrictions(index);
        return own !== undefined ? own : this.namespaceDefaults(nodes.namespace(index)).accessRestrictions;
    }

    /** the permissions the context's roles have on the node */
    public permissions(context: ISessionContext | null | undefined, index: number): PermissionFlag {
        if (!context?.session) {
            return allPermissions;
        }
        const unresolved = this.#policy === "deny" ? PermissionFlag.None : allPermissions;
        const roles = context.getCurrentUserRoles();
        if (roles.length === 0) {
            return unresolved;
        }
        const nodes = this.#space.store.nodes;
        const entries = nodes.rolePermissions(index) ?? this.namespaceDefaults(nodes.namespace(index)).rolePermissions;
        if (entries === null) {
            // neither the node nor its namespace declares a policy: nothing to match a role against
            return unresolved;
        }
        // every session stands on the Anonymous role: what it grants is the floor (see SessionContext)
        let flags = permissionsOfRole(entries, anonymousRole);
        for (const role of roles) {
            flags |= permissionsOfRole(entries, role);
        }
        return flags;
    }

    public namespaceDefaults(namespaceIndex: number): NamespacePermissionDefaults {
        let metadata = this.#metadata.get(namespaceIndex);
        if (metadata === undefined) {
            metadata = this.#findMetadata(namespaceIndex);
            this.#metadata.set(namespaceIndex, metadata);
        }
        if (metadata === null) {
            return this.#explicit.get(namespaceIndex) ?? NO_DEFAULTS;
        }
        const values = this.#space.store.values;
        const v = metadata.versions;
        if (
            v[0] !== values.version(metadata.restrictions) ||
            v[1] !== values.version(metadata.rolePermissions) ||
            v[2] !== values.version(metadata.userRolePermissions)
        ) {
            metadata.defaults = this.#readMetadata(metadata, namespaceIndex);
        }
        return metadata.defaults;
    }

    /** the NamespaceMetadata object of the namespace under Server/Namespaces, by its URI */
    #findMetadata(namespaceIndex: number): NamespaceMetadata | null {
        const space = this.#space;
        const uri = space.namespaceUris[namespaceIndex];
        const namespaces = space.findNode(SERVER_NAMESPACES);
        if (!namespaces || uri === undefined) {
            return null;
        }
        const object = namespaces.getComponents().find((c) => c.browseName.name === uri);
        if (!object) {
            return null;
        }
        const property = (name: string) => object.getPropertyByName(name, 0)?.index ?? -1;
        const metadata: NamespaceMetadata = {
            restrictions: property("DefaultAccessRestrictions"),
            rolePermissions: property("DefaultRolePermissions"),
            userRolePermissions: property("DefaultUserRolePermissions"),
            versions: [0, 0, 0],
            defaults: NO_DEFAULTS
        };
        metadata.defaults = this.#readMetadata(metadata, namespaceIndex);
        return metadata;
    }

    /** the metadata values, each field falling back on the application's setting when unset */
    #readMetadata(metadata: NamespaceMetadata, namespaceIndex: number): NamespacePermissionDefaults {
        const explicit = this.#explicit.get(namespaceIndex) ?? NO_DEFAULTS;
        const values = this.#space.store.values;
        const version = (i: number) => (i < 0 ? 0 : values.version(i));
        metadata.versions = [
            version(metadata.restrictions),
            version(metadata.rolePermissions),
            version(metadata.userRolePermissions)
        ];
        let accessRestrictions = explicit.accessRestrictions;
        if (
            metadata.restrictions >= 0 &&
            values.kind(metadata.restrictions) === ValueKind.Number &&
            values.statusCode(metadata.restrictions) === 0
        ) {
            accessRestrictions = values.number(metadata.restrictions);
        }
        // the user-specific policy wins when it carries a value, else the namespace policy
        const rolePermissions =
            rolePermissionEntries(values, metadata.userRolePermissions) ??
            rolePermissionEntries(values, metadata.rolePermissions) ??
            explicit.rolePermissions;
        return { accessRestrictions, rolePermissions };
    }
}

function rolePermissionEntries(values: StoreAddressSpace["store"]["values"], index: number): readonly RolePermissionEntry[] | null {
    if (index < 0 || values.kind(index) !== ValueKind.Object || values.statusCode(index) !== 0) {
        return null;
    }
    const stored = values.get(index).value as { value?: unknown } | null;
    const list = stored?.value;
    if (!Array.isArray(list) || list.length === 0) {
        return null;
    }
    return list
        .filter((r) => r?.roleId)
        .map((r: { roleId: NodeId | string; permissions?: number }) => ({
            roleId: resolveNodeId(r.roleId),
            permissions: r.permissions ?? 0
        }));
}

function permissionsOfRole(entries: readonly RolePermissionEntry[], role: NodeId): PermissionFlag {
    for (const entry of entries) {
        if (sameNodeId(entry.roleId, role)) {
            return entry.permissions;
        }
    }
    return PermissionFlag.None;
}
