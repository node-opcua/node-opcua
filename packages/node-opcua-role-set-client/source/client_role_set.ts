/**
 * @module node-opcua-role-set-client
 *
 * Client-side helpers for managing OPC UA Roles (OPC 10000-18).
 *
 * Uses {@link IBasicSessionAsync} to remain agnostic — works with
 * `ClientSession`, `PseudoSession`, or any compatible session.
 *
 * Method NodeIds are resolved via `translateBrowsePath` (same technique
 * as node-opcua-file-transfer).
 */

import { ObjectIds } from "node-opcua-constants";
import { AttributeIds, BrowseDirection, NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { CallMethodResult } from "node-opcua-service-call";
import type { BrowsePath } from "node-opcua-service-translate-browse-path";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityMappingRuleType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

/**
 * Cached method NodeIds for a Role node, resolved via translateBrowsePath.
 */
interface RoleMethodIds {
    addIdentityMethodId: NodeId | null;
    removeIdentityMethodId: NodeId | null;
    identitiesNodeId: NodeId | null;
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
 * Client-side wrapper for a single OPC UA Role node.
 *
 * Resolves method/property NodeIds via `translateBrowsePath` on first
 * use, then caches them for subsequent calls.
 */
export class ClientRole {
    public readonly roleNodeId: NodeId;
    public readonly session: IBasicSessionAsync;

    private _methodIds?: RoleMethodIds;

    constructor(session: IBasicSessionAsync, roleNodeId: NodeId) {
        this.session = session;
        this.roleNodeId = roleNodeId;
    }

    /**
     * Resolve AddIdentity, RemoveIdentity, and Identities NodeIds
     * via translateBrowsePath — cached after first call.
     */
    private async ensureInitialized(): Promise<RoleMethodIds> {
        if (this._methodIds) return this._methodIds;

        const browsePaths: BrowsePath[] = [
            makeBrowsePath(this.roleNodeId, "/AddIdentity"),
            makeBrowsePath(this.roleNodeId, "/RemoveIdentity"),
            makeBrowsePath(this.roleNodeId, "/Identities")
        ];

        const results = await this.session.translateBrowsePath(browsePaths);

        this._methodIds = {
            addIdentityMethodId: results[0].statusCode.isGood() && results[0].targets ? results[0].targets[0].targetId : null,
            removeIdentityMethodId: results[1].statusCode.isGood() && results[1].targets ? results[1].targets[0].targetId : null,
            identitiesNodeId: results[2].statusCode.isGood() && results[2].targets ? results[2].targets[0].targetId : null
        };

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
