/**
 * @module node-opcua-role-set-client
 *
 * Client-side API for OPC UA Role management (OPC 10000-18).
 *
 * The recommended entry point is {@link ClientRoleSet}, which wraps a session
 * and exposes the server `RoleSet` as cached {@link ClientRole} objects. All
 * navigation goes through {@link IBasicSessionAsync} (browse / read / call /
 * translateBrowsePath), so the **exact same code** drives a remote
 * `ClientSession` and an in-process `PseudoSession` — the single, recommended
 * way to interact with a RoleSet whether in-process or out-of-process.
 */

import { ObjectIds } from "node-opcua-constants";
import { AttributeIds, BrowseDirection, NodeClass } from "node-opcua-data-model";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { CallMethodResult } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type EndpointType, IdentityMappingRuleType } from "node-opcua-types";
import { DataType, type VariantOptions } from "node-opcua-variant";
import { resolveChildNodeIds } from "./resolve_child_node_ids.js";

/**
 * Cached method NodeIds for a Role node, resolved via translateBrowsePath.
 */
interface RoleMethodIds {
    addIdentityMethodId: NodeId | null;
    removeIdentityMethodId: NodeId | null;
    identitiesNodeId: NodeId | null;
    addApplicationMethodId: NodeId | null;
    removeApplicationMethodId: NodeId | null;
    addEndpointMethodId: NodeId | null;
    removeEndpointMethodId: NodeId | null;
}

/**
 * Result of reading a Role's identities.
 */
export interface RoleIdentitiesResult {
    roleNodeId: NodeId;
    roleName: string;
    identities: IdentityMappingRuleType[];
}

/**
 * Client-side entry point for the server `RoleSet` (OPC 10000-18 §4.3).
 *
 * Wraps an {@link IBasicSessionAsync} and exposes the Roles as cached
 * {@link ClientRole} objects, mirroring the way `PublishSubscribe` wraps a
 * session for PubSub. Construct one per session:
 *
 * ```ts
 * const roleSet = new ClientRoleSet(session);
 * const operator = await roleSet.getRole("Operator");
 * await operator?.addIdentity(rule);
 * ```
 */
export class ClientRoleSet {
    public readonly session: IBasicSessionAsync;
    public readonly roleSetNodeId: NodeId = resolveNodeId(ObjectIds.Server_ServerCapabilities_RoleSet);
    private _roles?: ClientRole[];
    private _roleSetMethods?: { addRole: NodeId | null; removeRole: NodeId | null };

    constructor(session: IBasicSessionAsync) {
        this.session = session;
    }

    private async ensureRoleSetMethods(): Promise<{ addRole: NodeId | null; removeRole: NodeId | null }> {
        if (this._roleSetMethods) return this._roleSetMethods;
        this._roleSetMethods = await resolveChildNodeIds(this.session, this.roleSetNodeId, {
            addRole: "/AddRole",
            removeRole: "/RemoveRole"
        });
        return this._roleSetMethods;
    }

    /**
     * Add a custom Role (OPC 10000-18 §4.2.2). The Server assigns the NodeId
     * (a `ns=1;g=<uuid>`). `namespaceUri` qualifies the BrowseName; empty → the
     * Server's own namespace.
     */
    public async addRole(roleName: string, namespaceUri = ""): Promise<{ statusCode: StatusCode; roleNodeId?: NodeId }> {
        const ids = await this.ensureRoleSetMethods();
        if (!ids.addRole) return { statusCode: StatusCodes.BadNotSupported };
        const result = await this.session.call({
            objectId: this.roleSetNodeId,
            methodId: ids.addRole,
            inputArguments: [
                { dataType: DataType.String, value: roleName },
                { dataType: DataType.String, value: namespaceUri }
            ]
        });
        this.invalidate();
        return { statusCode: result.statusCode, roleNodeId: result.outputArguments?.[0]?.value as NodeId | undefined };
    }

    /** Remove a custom Role (OPC 10000-18 §4.2.3). Well-known Roles cannot be removed. */
    public async removeRole(roleNodeId: NodeId): Promise<CallMethodResult> {
        const ids = await this.ensureRoleSetMethods();
        if (!ids.removeRole) return new CallMethodResult({ statusCode: StatusCodes.BadNotSupported });
        const result = await this.session.call({
            objectId: this.roleSetNodeId,
            methodId: ids.removeRole,
            inputArguments: [{ dataType: DataType.NodeId, value: roleNodeId }]
        });
        this.invalidate();
        return result;
    }

    /** Browse the RoleSet and return a {@link ClientRole} per Role (cached). */
    public async getRoles(): Promise<ClientRole[]> {
        if (this._roles) {
            return this._roles;
        }
        const refs = await browseRoles(this.session);
        this._roles = refs.map((r) => new ClientRole(this.session, r.roleNodeId, r.roleName));
        return this._roles;
    }

    /** Find a Role by its BrowseName (e.g. "Operator"), or `undefined`. The common case. */
    public async getRole(roleName: string): Promise<ClientRole | undefined> {
        const roles = await this.getRoles();
        return roles.find((r) => r.roleName === roleName);
    }

    /** Find a Role by its NodeId (e.g. a custom Role's `ns=1;g=…`), or `undefined`. */
    public async getRoleByNodeId(roleNodeId: NodeId): Promise<ClientRole | undefined> {
        const roles = await this.getRoles();
        return roles.find((r) => sameNodeId(r.roleNodeId, roleNodeId));
    }

    /** Read the identities of every Role in the RoleSet. */
    public async readAllRoleIdentities(): Promise<RoleIdentitiesResult[]> {
        const roles = await this.getRoles();
        const results: RoleIdentitiesResult[] = [];
        for (const role of roles) {
            const identities = await role.readIdentities();
            results.push({ roleNodeId: role.roleNodeId, roleName: role.roleName, identities });
        }
        return results;
    }

    /** Discard the cached Roles (e.g. after AddRole/RemoveRole). */
    public invalidate(): void {
        this._roles = undefined;
    }
}

/**
 * Client-side wrapper for a single OPC UA Role node.
 *
 * Resolves method/property NodeIds via `translateBrowsePath` on first
 * use, then caches them for subsequent calls. Usually obtained from
 * {@link ClientRoleSet.getRole}.
 */
export class ClientRole {
    public readonly roleNodeId: NodeId;
    public readonly session: IBasicSessionAsync;
    /** The Role BrowseName, when known (set when created via {@link ClientRoleSet}). */
    public readonly roleName: string;

    private _methodIds?: RoleMethodIds;

    constructor(session: IBasicSessionAsync, roleNodeId: NodeId, roleName = "") {
        this.session = session;
        this.roleNodeId = roleNodeId;
        this.roleName = roleName;
    }

    /** Read this Role's BrowseName from the server. */
    public async getBrowseName(): Promise<string> {
        if (this.roleName) {
            return this.roleName;
        }
        const dataValue = await this.session.read({ nodeId: this.roleNodeId, attributeId: AttributeIds.BrowseName });
        return dataValue.value?.value?.name ?? "";
    }

    /**
     * Resolve AddIdentity, RemoveIdentity, and Identities NodeIds
     * via translateBrowsePath — cached after first call.
     */
    private async ensureInitialized(): Promise<RoleMethodIds> {
        if (this._methodIds) return this._methodIds;
        this._methodIds = await resolveChildNodeIds(this.session, this.roleNodeId, {
            addIdentityMethodId: "/AddIdentity",
            removeIdentityMethodId: "/RemoveIdentity",
            identitiesNodeId: "/Identities",
            addApplicationMethodId: "/AddApplication",
            removeApplicationMethodId: "/RemoveApplication",
            addEndpointMethodId: "/AddEndpoint",
            removeEndpointMethodId: "/RemoveEndpoint"
        });
        return this._methodIds;
    }

    /**
     * Read the current identities assigned to this role.
     */
    public async readIdentities(): Promise<IdentityMappingRuleType[]> {
        const ids = await this.ensureInitialized();
        if (!ids.identitiesNodeId) {
            return [];
        }

        const dataValue = await this.session.read({
            nodeId: ids.identitiesNodeId,
            attributeId: AttributeIds.Value
        });

        if (!dataValue.value?.value) {
            return [];
        }

        const value = dataValue.value.value;
        if (Array.isArray(value)) {
            return value.filter((v: unknown) => v instanceof IdentityMappingRuleType);
        }
        return [];
    }

    /**
     * Call AddIdentity on this role.
     */
    public async addIdentity(rule: IdentityMappingRuleType): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.addIdentityMethodId) {
            // The Role does not expose AddIdentity — per OPC 10000-18 §4.4.5 the
            // Method is omitted when the Server does not allow changes (e.g. the
            // immutable well-known Roles). Report it as a normal Bad status so the
            // client API behaves uniformly instead of throwing.
            return new CallMethodResult({ statusCode: StatusCodes.BadNotSupported });
        }

        return this.session.call({
            objectId: this.roleNodeId,
            methodId: ids.addIdentityMethodId,
            inputArguments: [{ dataType: DataType.ExtensionObject, value: rule }]
        });
    }

    /**
     * Call RemoveIdentity on this role.
     */
    public async removeIdentity(rule: IdentityMappingRuleType): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.removeIdentityMethodId) {
            // See addIdentity: the Method is omitted when changes are not allowed.
            return new CallMethodResult({ statusCode: StatusCodes.BadNotSupported });
        }

        return this.session.call({
            objectId: this.roleNodeId,
            methodId: ids.removeIdentityMethodId,
            inputArguments: [{ dataType: DataType.ExtensionObject, value: rule }]
        });
    }

    private async callRoleMethod(methodId: NodeId | null, inputArguments: VariantOptions[]): Promise<CallMethodResult> {
        if (!methodId) {
            return new CallMethodResult({ statusCode: StatusCodes.BadNotSupported });
        }
        return this.session.call({ objectId: this.roleNodeId, methodId, inputArguments });
    }

    /** Call AddApplication on this Role (OPC 10000-18 §4.4.7). */
    public async addApplication(applicationUri: string): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        return this.callRoleMethod(ids.addApplicationMethodId, [{ dataType: DataType.String, value: applicationUri }]);
    }

    /** Call RemoveApplication on this Role (§4.4.8). */
    public async removeApplication(applicationUri: string): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        return this.callRoleMethod(ids.removeApplicationMethodId, [{ dataType: DataType.String, value: applicationUri }]);
    }

    /** Call AddEndpoint on this Role (§4.4.9). */
    public async addEndpoint(endpoint: EndpointType): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        return this.callRoleMethod(ids.addEndpointMethodId, [{ dataType: DataType.ExtensionObject, value: endpoint }]);
    }

    /** Call RemoveEndpoint on this Role (§4.4.10). */
    public async removeEndpoint(endpoint: EndpointType): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        return this.callRoleMethod(ids.removeEndpointMethodId, [{ dataType: DataType.ExtensionObject, value: endpoint }]);
    }
}

/**
 * Browse the RoleSet and return the NodeId + name of each Role.
 */
export async function browseRoles(session: IBasicSessionAsync): Promise<Array<{ roleNodeId: NodeId; roleName: string }>> {
    const roleSetNodeId = ObjectIds.Server_ServerCapabilities_RoleSet;

    const browseResult = await session.browse({
        nodeId: roleSetNodeId,
        browseDirection: BrowseDirection.Forward,
        nodeClassMask: NodeClass.Object,
        resultMask: 0x3f
    });

    const roles: Array<{ roleNodeId: NodeId; roleName: string }> = [];
    if (browseResult.references) {
        for (const ref of browseResult.references) {
            if (ref.nodeClass !== NodeClass.Object) continue;
            roles.push({
                roleNodeId: ref.nodeId,
                roleName: ref.browseName.name ?? ""
            });
        }
    }
    return roles;
}

/**
 * Read identities for all roles in the RoleSet.
 */
export async function readAllRoleIdentities(session: IBasicSessionAsync): Promise<RoleIdentitiesResult[]> {
    const roles = await browseRoles(session);
    const results: RoleIdentitiesResult[] = [];

    for (const { roleNodeId, roleName } of roles) {
        const clientRole = new ClientRole(session, roleNodeId);
        const identities = await clientRole.readIdentities();
        results.push({ roleNodeId, roleName, identities });
    }

    return results;
}
