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
import type { IAddressSpace, ISessionContext, UAMethod, UAObject, UARole, UARoleSet } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    ArchiveStore,
    deserializeRestrictions,
    type IIdentityMappingStore,
    InMemoryIdentityMappingStore,
    InMemoryRoleRestrictionStore,
    type IRoleRestrictionStore,
    identitiesFromBase64,
    identitiesToBase64,
    type PersistedCustomRole,
    serializeRestrictions,
    WellKnownRoles
} from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { EndpointType } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { raiseAuditMethodEvent } from "./audit.js";
import {
    type BindRestrictionMethodsOptions,
    makeAddApplicationHandler,
    makeAddEndpointHandler,
    makeRemoveApplicationHandler,
    makeRemoveEndpointHandler
} from "./bind_restriction_methods.js";
import {
    type BindRoleMethodsOptions,
    makeAddIdentityHandler,
    makeRemoveIdentityHandler,
    type RoleMappingRuleChangedAudit
} from "./bind_role_methods.js";
import { hardenAdminOnly } from "./harden.js";
import { RoleSetResolver } from "./role_set_resolver.js";
import { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";
import { asString } from "./variant_args.js";

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";

/** Persisted definition of a custom Role (so its GUID NodeId survives a restart). */
type CustomRoleDef = PersistedCustomRole;

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
    /**
     * Path to a single consolidated archive file holding the whole RoleSet
     * configuration (identity mappings, custom Role definitions and
     * application/endpoint restrictions). Written atomically on every change.
     */
    persistencePath?: string;
    /**
     * When set, the archive is encrypted at rest (AES-256-GCM, key derived from
     * this operator-supplied secret). Omit to store plain JSON (relying on
     * filesystem permissions); the stored password material is salted scrypt
     * hashes either way.
     */
    persistenceSecret?: string;
    /**
     * A shared {@link ArchiveStore} coordinating one consolidated file across
     * `installRoleSet` and `installUserManagement`. Pass the **same** instance to
     * both so users and roles live in one archive. When omitted, an internal one
     * is created from `persistencePath`/`persistenceSecret` (role config only).
     */
    persistence?: ArchiveStore;
    /**
     * Identity-mapping store to bind the RoleSet to. When omitted a new
     * {@link InMemoryIdentityMappingStore} is created. Inject a shared store so the
     * **same** mappings drive role resolution (e.g. via the server `userManager`),
     * the `Identities` Property shown in clients, and the RoleSet Methods —
     * keeping a single source of truth. Persisted mappings (if any) are merged in.
     */
    store?: IIdentityMappingStore;
}

export interface InstallRoleSetResult {
    /** The identity mapping store backing the role set. */
    store: IIdentityMappingStore;
    /** The per-Role application/endpoint restriction store (§4.4.1). */
    restrictionStore: IRoleRestrictionStore;
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

    // The consolidated archive is owned either by a shared coordinator (when also
    // installing user management into the same file) or created from the path here.
    const persistence =
        options?.persistence ??
        (options?.persistencePath ? new ArchiveStore(options.persistencePath, { secret: options.persistenceSecret }) : undefined);

    // Load the whole configuration from the single consolidated archive (if any).
    const archive = persistence ? await persistence.load() : undefined;

    const store = options?.store ?? new InMemoryIdentityMappingStore();
    identitiesFromBase64(store, archive?.identities);

    const restrictionStore = new InMemoryRoleRestrictionStore();
    if (archive?.restrictions) {
        deserializeRestrictions(restrictionStore, archive.restrictions);
    }

    const resolver = new RoleSetResolver(store, restrictionStore);
    server.roleResolvers ??= [];
    server.roleResolvers.push(resolver);

    function refreshIdentities(role: UARole): void {
        role.identities.setValueFromSource({
            dataType: DataType.ExtensionObject,
            value: store.getIdentitiesForRole(role.nodeId)
        });
    }

    /** Refresh a Role's Applications/Endpoints restriction variables from the store. */
    function refreshRestrictions(role: UARole): void {
        role.applications?.setValueFromSource({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: restrictionStore.getApplications(role.nodeId)
        });
        role.applicationsExclude?.setValueFromSource({
            dataType: DataType.Boolean,
            value: restrictionStore.getApplicationsExclude(role.nodeId)
        });
        role.endpoints?.setValueFromSource({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: restrictionStore.getEndpoints(role.nodeId).map((e) => new EndpointType(e))
        });
        role.endpointsExclude?.setValueFromSource({
            dataType: DataType.Boolean,
            value: restrictionStore.getEndpointsExclude(role.nodeId)
        });
    }

    const customRoles: CustomRoleDef[] = [];

    // Register the sections we own; the coordinator gathers these (plus any users
    // registered by installUserManagement) and rewrites the one file atomically.
    persistence?.setIdentitiesProvider(() => identitiesToBase64(store));
    persistence?.setRolesProvider(() => customRoles);
    persistence?.setRestrictionsProvider(() => serializeRestrictions(restrictionStore));

    /** Snapshot every store into the single consolidated archive (atomic write). */
    async function persist(): Promise<void> {
        await persistence?.save();
    }

    /** Refresh every Role's variables and persist the whole configuration. */
    const afterMutation = async () => {
        forEachRole(roleSet, (role) => {
            refreshIdentities(role);
            refreshRestrictions(role);
        });
        await persist();
    };

    // Raise a RoleMappingRuleChangedAuditEventType on the Server object (§4.5).
    // The IdentityMappingRule carries no secret, so it is included.
    const serverObject = addressSpace.rootFolder?.objects?.server;
    const raiseRoleMappingAudit = (audit: RoleMappingRuleChangedAudit): void => {
        raiseAuditMethodEvent(serverObject, "RoleMappingRuleChangedAuditEventType", {
            sourceNode: audit.roleNodeId,
            sourceName: `Method/${audit.method}`,
            methodId: audit.methodNodeId,
            clientUserId: audit.userName,
            status: audit.statusCode === StatusCodes.Good,
            message: `${audit.method} on role ${audit.roleNodeId.toString()} by '${audit.userName}' → ${audit.statusCode.name}`,
            inputArguments: audit.inputArguments
        });
    };

    const methodOptions: BindRoleMethodsOptions = { store, onMutation: afterMutation, onAudit: raiseRoleMappingAudit };
    const addIdentityHandler = makeAddIdentityHandler(methodOptions);
    const removeIdentityHandler = makeRemoveIdentityHandler(methodOptions);

    const restrictionMethodOptions: BindRestrictionMethodsOptions = {
        restrictionStore,
        onMutation: afterMutation,
        onAudit: raiseRoleMappingAudit
    };
    const addApplicationHandler = makeAddApplicationHandler(restrictionMethodOptions);
    const removeApplicationHandler = makeRemoveApplicationHandler(restrictionMethodOptions);
    const addEndpointHandler = makeAddEndpointHandler(restrictionMethodOptions);
    const removeEndpointHandler = makeRemoveEndpointHandler(restrictionMethodOptions);

    /** Bind the identity + restriction Methods on a Role and seed its variables. */
    function bindRoleMethods(role: UARole): void {
        refreshIdentities(role);
        refreshRestrictions(role);
        role.addIdentity?.bindMethod(addIdentityHandler);
        role.removeIdentity?.bindMethod(removeIdentityHandler);
        role.addApplication?.bindMethod(addApplicationHandler);
        role.removeApplication?.bindMethod(removeApplicationHandler);
        role.addEndpoint?.bindMethod(addEndpointHandler);
        role.removeEndpoint?.bindMethod(removeEndpointHandler);
        hardenRole(role);
    }

    /**
     * Hide a Role's sensitive Properties and configuration Methods from
     * non-admin Browse and require an encrypted channel (§4.4.1). The Role node
     * itself stays browsable so the RoleSet hierarchy remains visible.
     */
    function hardenRole(role: UARole): void {
        hardenAdminOnly(role.identities);
        hardenAdminOnly(role.applications);
        hardenAdminOnly(role.applicationsExclude);
        hardenAdminOnly(role.endpoints);
        hardenAdminOnly(role.endpointsExclude);
        hardenAdminOnly(role.addIdentity);
        hardenAdminOnly(role.removeIdentity);
        hardenAdminOnly(role.addApplication);
        hardenAdminOnly(role.removeApplication);
        hardenAdminOnly(role.addEndpoint);
        hardenAdminOnly(role.removeEndpoint);
    }

    /** Create a RoleType instance (with the configuration Methods) and bind it. */
    const createRoleNode = (roleName: string, browseNameNamespace: number, nodeId: NodeId): UARole => {
        const roleType = addressSpace.findObjectType("RoleType");
        if (!roleType) {
            throw new Error("installRoleSet: RoleType ObjectType not found");
        }
        const role = roleType.instantiate({
            browseName: { name: roleName, namespaceIndex: browseNameNamespace },
            componentOf: roleSet,
            nodeId,
            optionals: [
                "AddIdentity",
                "RemoveIdentity",
                "AddApplication",
                "RemoveApplication",
                "AddEndpoint",
                "RemoveEndpoint",
                "Applications",
                "ApplicationsExclude",
                "Endpoints",
                "EndpointsExclude"
            ]
        }) as UARole;
        bindRoleMethods(role);
        return role;
    };

    // Recreate persisted custom Roles before binding the standard ones.
    for (const def of archive?.roles ?? []) {
        const nodeId = resolveNodeId(def.nodeId);
        const nsIndex = def.namespaceUri ? ensureNamespace(addressSpace, def.namespaceUri) : addressSpace.getOwnNamespace().index;
        if (!addressSpace.findNode(nodeId)) {
            createRoleNode(def.roleName, nsIndex, nodeId);
        }
        customRoles.push(def);
    }

    // Bind the configuration Methods on every current Role and seed its variables.
    forEachRole(roleSet, bindRoleMethods);

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
        await persist();

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

        await persist();
        return { statusCode: StatusCodes.Good };
    };

    if (roleSet.addRole) {
        (roleSet.addRole as UAMethod).bindMethod(addRoleHandler);
        hardenAdminOnly(roleSet.addRole);
    }
    if (roleSet.removeRole) {
        (roleSet.removeRole as UAMethod).bindMethod(removeRoleHandler);
        hardenAdminOnly(roleSet.removeRole);
    }

    return { store, restrictionStore, resolver };
}

/** Resolve a namespace URI to its index, registering it if necessary. */
function ensureNamespace(addressSpace: IAddressSpace, namespaceUri: string): number {
    const idx = addressSpace.getNamespaceIndex(namespaceUri);
    return idx >= 0 ? idx : addressSpace.registerNamespace(namespaceUri).index;
}
