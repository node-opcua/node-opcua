/**
 * @module node-opcua-role-set-server
 *
 * Install RoleSet management on an OPC UA server.
 *
 * This function is designed to be called **after** the server has started
 * (when the address space is available). It:
 *   - Creates an InMemoryIdentityMappingStore (optionally loaded from disk)
 *   - Registers a RoleSetResolver on server.roleResolvers
 *   - Binds AddIdentity / RemoveIdentity on each Role and keeps the Identities
 *     Property in sync with the store
 *   - Binds AddRole / RemoveRole (OPC 10000-18 §4.2): custom Roles are created
 *     as `ns=1;g=<uuid>` instances of RoleType (collision-proof, stable when
 *     persisted); well-known Roles cannot be removed.
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import type { IAddressSpace, ISessionContext, UAMethod, UAObject, UARole, UARoleSet } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    type IIdentityMappingStore,
    InMemoryIdentityMappingStore,
    loadFromBinaryFile,
    saveToBinaryFile,
    WellKnownRoles
} from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import type { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { type BindRoleMethodsOptions, makeAddIdentityHandler, makeRemoveIdentityHandler } from "./bind_role_methods.js";
import { RoleSetResolver } from "./role_set_resolver.js";
import { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";
import { asString } from "./variant_args.js";

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";

/** Persisted definition of a custom Role (so its GUID NodeId survives a restart). */
interface CustomRoleDef {
    nodeId: string;
    roleName: string;
    namespaceUri: string;
}

/** Iterate the Role components of a RoleSet (UAObjects of type RoleType). */
function forEachRole(roleSet: UARoleSet, fn: (role: UARole) => void): void {
    for (const c of roleSet.getComponents()) {
        if (c.nodeClass !== NodeClass.Object) continue;
        const obj = c as UAObject;
        if (obj.typeDefinitionObj.browseName.name !== "RoleType") continue;
        fn(obj as UARole);
    }
}

/** True for the standard well-known Roles (ns=0 numeric NodeIds, OPC 10000-3). */
function isWellKnownRoleNodeId(nodeId: NodeId): boolean {
    if (nodeId.namespace !== 0 || nodeId.identifierType !== NodeIdType.NUMERIC) {
        return false;
    }
    const values = Object.values(WellKnownRoles).filter((v): v is number => typeof v === "number");
    return values.includes(nodeId.value as number);
}

/** The BrowseNames of the standard well-known Roles (OPC 10000-3). */
const WELL_KNOWN_ROLE_NAMES = new Set(Object.keys(WellKnownRoles).filter((k) => Number.isNaN(Number(k))));

export interface InstallRoleSetOptions {
    /** Path to persist role-identity mappings (binary file). Custom Role definitions are stored alongside as `<path>.roles.json`. */
    persistencePath?: string;
}

export interface InstallRoleSetResult {
    /** The identity mapping store backing the role set. */
    store: IIdentityMappingStore;
    /** The resolver registered on server.roleResolvers. */
    resolver: RoleSetResolver;
}

/**
 * The server-like object we need — just needs `roleResolvers` and
 * access to the address space.
 */
export interface IServerForRoleSet {
    roleResolvers: Array<{ resolveRoles(token: unknown): unknown[] }>;
    engine: {
        addressSpace: IAddressSpace | null;
    };
}

/**
 * Install RoleSet management on an OPC UA server. Call this **after**
 * `server.start()` so the address space is available.
 */
export async function installRoleSet(server: IServerForRoleSet, options?: InstallRoleSetOptions): Promise<InstallRoleSetResult> {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("installRoleSet: address space is not available. Call this after server.start().");
    }

    const roleSet = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_RoleSet) as UARoleSet | null;
    if (!roleSet) {
        throw new Error("installRoleSet: RoleSet node (i=15606) not found in address space.");
    }

    const persistencePath = options?.persistencePath;
    const rolesSidecar = persistencePath ? `${persistencePath}.roles.json` : undefined;

    const store = new InMemoryIdentityMappingStore();
    if (persistencePath) {
        await loadFromBinaryFile(store, persistencePath);
    }

    const resolver = new RoleSetResolver(store);
    server.roleResolvers ??= [];
    server.roleResolvers.push(resolver);

    function refreshIdentities(role: UARole): void {
        role.identities.setValueFromSource({
            dataType: DataType.ExtensionObject,
            value: store.getIdentitiesForRole(role.nodeId)
        });
    }

    const customRoles: CustomRoleDef[] = [];

    async function persistCustomRoles(): Promise<void> {
        if (rolesSidecar) {
            await fs.writeFile(rolesSidecar, JSON.stringify(customRoles, null, 2), "utf8");
        }
    }

    /** Refresh every Role's Identities variable and persist the mappings. */
    const afterMutation = async () => {
        forEachRole(roleSet, refreshIdentities);
        if (persistencePath) {
            await saveToBinaryFile(store, persistencePath);
        }
    };

    const methodOptions: BindRoleMethodsOptions = { store, onMutation: afterMutation };
    const addIdentityHandler = makeAddIdentityHandler(methodOptions);
    const removeIdentityHandler = makeRemoveIdentityHandler(methodOptions);

    /** Create a RoleType instance (with AddIdentity/RemoveIdentity) and bind it. */
    const createRoleNode = (roleName: string, browseNameNamespace: number, nodeId: NodeId): UARole => {
        const roleType = addressSpace.findObjectType("RoleType");
        if (!roleType) {
            throw new Error("installRoleSet: RoleType ObjectType not found");
        }
        const role = roleType.instantiate({
            browseName: { name: roleName, namespaceIndex: browseNameNamespace },
            componentOf: roleSet,
            nodeId,
            optionals: ["AddIdentity", "RemoveIdentity"]
        }) as UARole;
        role.addIdentity?.bindMethod(addIdentityHandler);
        role.removeIdentity?.bindMethod(removeIdentityHandler);
        refreshIdentities(role);
        return role;
    };

    // Recreate persisted custom Roles before binding the standard ones.
    if (rolesSidecar) {
        try {
            const defs: CustomRoleDef[] = JSON.parse(await fs.readFile(rolesSidecar, "utf8"));
            for (const def of defs) {
                const nodeId = resolveNodeId(def.nodeId);
                const nsIndex = def.namespaceUri
                    ? ensureNamespace(addressSpace, def.namespaceUri)
                    : addressSpace.getOwnNamespace().index;
                if (!addressSpace.findNode(nodeId)) {
                    createRoleNode(def.roleName, nsIndex, nodeId);
                }
                customRoles.push(def);
            }
        } catch {
            // missing/invalid sidecar → start with no custom roles
        }
    }

    // Bind AddIdentity/RemoveIdentity on every current Role and seed the variable.
    forEachRole(roleSet, (role) => {
        refreshIdentities(role);
        role.addIdentity?.bindMethod(addIdentityHandler);
        role.removeIdentity?.bindMethod(removeIdentityHandler);
    });

    // AddRole (§4.2.2)
    const addRoleHandler = async function (
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const roleName = asString(inputArguments[0]);
        if (!roleName) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        // A custom Role must not impersonate a well-known Role (which already
        // exists in ns=0); reject the name in any namespace (§4.2.2).
        if (WELL_KNOWN_ROLE_NAMES.has(roleName)) {
            return { statusCode: StatusCodes.BadAlreadyExists };
        }
        const namespaceUri = asString(inputArguments[1]) ?? "";
        const browseNameNamespace =
            namespaceUri && namespaceUri !== UA_NAMESPACE_URI
                ? ensureNamespace(addressSpace, namespaceUri)
                : namespaceUri === UA_NAMESPACE_URI
                  ? 0
                  : addressSpace.getOwnNamespace().index;

        // The RoleName must be unique within the RoleSet (§4.2.2). We check by
        // name across *all* namespaces (not just name+namespace) so a custom Role
        // can never duplicate the name of any existing Role — well-known or custom.
        const exists = roleSet.getComponents().some((c) => c.browseName.name === roleName);
        if (exists) {
            return { statusCode: StatusCodes.BadAlreadyExists };
        }

        // GUID NodeId in the server's own namespace (collision-proof, persisted)
        const nodeId = new NodeId(NodeIdType.GUID, randomUUID().toUpperCase(), addressSpace.getOwnNamespace().index);
        createRoleNode(roleName, browseNameNamespace, nodeId);

        customRoles.push({ nodeId: nodeId.toString(), roleName, namespaceUri });
        await persistCustomRoles();

        return {
            statusCode: StatusCodes.Good,
            outputArguments: [{ dataType: DataType.NodeId, value: nodeId }]
        };
    };

    // RemoveRole (§4.2.3)
    const removeRoleHandler = async function (
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const roleNodeId = inputArguments[0]?.value;
        if (!(roleNodeId instanceof NodeId)) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        // Well-known Roles are required by the Server and cannot be removed (§4.3)
        if (isWellKnownRoleNodeId(roleNodeId)) {
            return { statusCode: StatusCodes.BadRequestNotAllowed };
        }
        const node = addressSpace.findNode(roleNodeId) as UARole | null;
        if (node?.typeDefinitionObj?.browseName.name !== "RoleType") {
            return { statusCode: StatusCodes.BadNodeIdUnknown };
        }

        // remove the node, its identity mappings and the persisted definition
        for (const rule of store.getIdentitiesForRole(roleNodeId)) {
            store.removeIdentity(roleNodeId, rule);
        }
        addressSpace.deleteNode(roleNodeId);
        const idx = customRoles.findIndex((r) => sameNodeId(resolveNodeId(r.nodeId), roleNodeId));
        if (idx >= 0) customRoles.splice(idx, 1);

        await persistCustomRoles();
        if (persistencePath) {
            await saveToBinaryFile(store, persistencePath);
        }
        return { statusCode: StatusCodes.Good };
    };

    if (roleSet.addRole) {
        (roleSet.addRole as UAMethod).bindMethod(addRoleHandler);
    }
    if (roleSet.removeRole) {
        (roleSet.removeRole as UAMethod).bindMethod(removeRoleHandler);
    }

    return { store, resolver };
}

/** Resolve a namespace URI to its index, registering it if necessary. */
function ensureNamespace(addressSpace: IAddressSpace, namespaceUri: string): number {
    const idx = addressSpace.getNamespaceIndex(namespaceUri);
    return idx >= 0 ? idx : addressSpace.registerNamespace(namespaceUri).index;
}
