/**
 * @module node-opcua-role-set-server
 *
 * Install RoleSet management on an OPC UA server.
 *
 * This function is designed to be called **after** the server has started
 * (when the address space is available). It layers on top of the existing
 * `bindRoleSet()` by:
 *   - Creating an InMemoryIdentityMappingStore
 *   - Optionally loading persisted state from a binary file
 *   - Registering a RoleSetResolver on server.roleResolvers
 *   - Binding AddIdentity / RemoveIdentity method handlers on each Role
 *   - Overriding the identities variable getter with the store-backed one
 *   - Binding AddRole / RemoveRole as BadNotImplemented stubs
 */
import type { BaseNode, IAddressSpace, UAMethod, UAObject, UARole, UARoleSet } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import {
    type IIdentityMappingStore,
    InMemoryIdentityMappingStore,
    loadFromBinaryFile,
    saveToBinaryFile
} from "node-opcua-role-set-common";
import { DataType } from "node-opcua-variant";
import {
    addRoleNotImplemented,
    type BindRoleMethodsOptions,
    makeAddIdentityHandler,
    makeRemoveIdentityHandler,
    removeRoleNotImplemented
} from "./bind_role_methods.js";
import { RoleSetResolver } from "./role_set_resolver.js";

/**
 * Iterate the components of a RoleSet, calling `fn` for each
 * Role (i.e. each UAObject whose typeDefinition is RoleType).
 */
function forEachRole(components: BaseNode[], fn: (role: UARole) => void): void {
    for (const c of components) {
        if (c.nodeClass !== NodeClass.Object) continue;
        const obj = c as UAObject;
        if (obj.typeDefinitionObj.browseName.name !== "RoleType") continue;
        fn(obj as UARole);
    }
}

export interface InstallRoleSetOptions {
    /** Path to persist role-identity mappings (binary file). */
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
 * access to the address space. We avoid importing OPCUAServer directly
 * to keep the dependency lightweight.
 */
export interface IServerForRoleSet {
    roleResolvers: Array<{ resolveRoles(token: unknown): unknown[] }>;
    engine: {
        addressSpace: IAddressSpace | null;
    };
}

/**
 * Install RoleSet management on an OPC UA server.
 *
 * Call this **after** the server has started and the address space is
 * available (e.g., in the `post_initialize` event or after `server.start()`).
 *
 * @example
 * ```typescript
 * const server = new OPCUAServer({ ... });
 * await server.start();
 * const { store, resolver } = await installRoleSet(server, {
 *     persistencePath: "./role-identities.bin"
 * });
 * ```
 */
export async function installRoleSet(server: IServerForRoleSet, options?: InstallRoleSetOptions): Promise<InstallRoleSetResult> {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("installRoleSet: address space is not available. Call this after server.start().");
    }

    // 1. Find the RoleSet node
    const roleSet = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_RoleSet) as UARoleSet | null;
    if (!roleSet) {
        throw new Error("installRoleSet: RoleSet node (i=15606) not found in address space.");
    }

    // 2. Create store and optionally load persisted state
    const store = new InMemoryIdentityMappingStore();
    if (options?.persistencePath) {
        await loadFromBinaryFile(store, options.persistencePath);
    }

    // 3. Register resolver
    const resolver = new RoleSetResolver(store);
    if (!server.roleResolvers) {
        server.roleResolvers = [];
    }
    server.roleResolvers.push(resolver);

    // 4. Iterate Role components and bind methods + variable
    const components = roleSet.getComponents();

    /** Refresh the identities variable on a Role from the store. */
    function refreshIdentities(role: UARole): void {
        const identities = store.getIdentitiesForRole(role.nodeId);
        role.identities.setValueFromSource({
            dataType: DataType.ExtensionObject,
            value: identities
        });
    }

    /**
     * Called after every store mutation.
     *
     * Refreshes **all** role identity variables (not just the one that
     * was mutated) for simplicity — the cost is negligible given the
     * small number of well-known roles.
     */
    const afterMutation = async () => {
        forEachRole(components, refreshIdentities);
        if (options?.persistencePath) {
            await saveToBinaryFile(store, options.persistencePath);
        }
    };

    const methodOptions: BindRoleMethodsOptions = {
        store,
        onMutation: afterMutation
    };
    const addIdentityHandler = makeAddIdentityHandler(methodOptions);
    const removeIdentityHandler = makeRemoveIdentityHandler(methodOptions);

    forEachRole(components, (role: UARole) => {
        // Set initial value from store
        refreshIdentities(role);

        // Bind AddIdentity method (if present — optional in spec)
        if (role.addIdentity) {
            role.addIdentity.bindMethod(addIdentityHandler);
        }

        // Bind RemoveIdentity method (if present — optional in spec)
        if (role.removeIdentity) {
            role.removeIdentity.bindMethod(removeIdentityHandler);
        }
    });

    // 6. Bind AddRole / RemoveRole stubs
    if (roleSet.addRole) {
        (roleSet.addRole as UAMethod).bindMethod(addRoleNotImplemented);
    }
    if (roleSet.removeRole) {
        (roleSet.removeRole as UAMethod).bindMethod(removeRoleNotImplemented);
    }

    return { store, resolver };
}
