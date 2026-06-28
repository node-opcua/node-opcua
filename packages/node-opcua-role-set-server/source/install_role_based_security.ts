/**
 * @module node-opcua-role-set-server
 *
 * One-call wiring for role-based security (OPC 10000-18) with a **single source
 * of truth**. It owns one user store and one identity store and exposes them
 * through the server `userManager` bridge — the only integration point the
 * server core uses to resolve a session's Roles (`getUserRoles`) and to back
 * each Role's `Identities` Property (`getIdentitiesForRole`).
 *
 * Because the `userManager` is created **before** the server (it is a
 * constructor option) but the RoleSet / User Management Methods are installed
 * **after** `server.start()`, this comes in two phases:
 *
 * ```ts
 * const security = createRoleBasedSecurity({
 *     users: [{ userName: "admin", password: "pw", roles: [WellKnownRoleIds.SecurityAdmin] }]
 * });
 * const server = new OPCUAServer({ ..., userManager: security.userManager });
 * await server.start();
 * await security.install(server, { persistencePath: "./role-set.json" });
 * ```
 *
 * Everything (resolution, the `Identities` Property, the AddIdentity/AddUser
 * Methods, persistence) is backed by the same two stores, so the "legacy"
 * (userManager) and "modern" (RoleSet Methods) views can never drift apart.
 */
import type { NodeId } from "node-opcua-nodeid";
import {
    ArchiveStore,
    InMemoryIdentityMappingStore,
    InMemoryUserManagementStore,
    type PasswordPolicy
} from "node-opcua-role-set-common";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import { type InstallRoleSetResult, type IServerForRoleSet, installRoleSet } from "./install_role_set.js";
import {
    type InstallUserManagementResult,
    type IServerForUserManagement,
    installUserManagement
} from "./install_user_management.js";
import { createUserManager, type IManagedUserManager } from "./user_management_user_manager.js";

/** A user to seed, with the well-known/custom Roles it holds. */
export interface RoleBasedUser {
    userName: string;
    password: string;
    /** Role NodeIds granted to this user (e.g. `WellKnownRoleIds.Operator`). */
    roles?: NodeId[];
    userConfiguration?: UserConfigurationMask;
    description?: string;
}

export interface CreateRoleBasedSecurityOptions {
    /** Password policy enforced by the user store. */
    policy?: PasswordPolicy;
    /** Users to seed up front (more can be added later via the Methods). */
    users?: RoleBasedUser[];
}

export interface InstallRoleBasedSecurityOptions {
    /** A shared archive coordinator. When omitted, one is built from `persistencePath`. */
    persistence?: ArchiveStore;
    /** Path to a single consolidated archive for roles + users. */
    persistencePath?: string;
    /** Encrypt that archive at rest (AES-256-GCM, key derived from this secret). */
    persistenceSecret?: string;
}

/** The shared stores + bridge produced by {@link createRoleBasedSecurity}. */
export interface RoleBasedSecurity {
    /** The single user store (passwords / user lifecycle). */
    userStore: InMemoryUserManagementStore;
    /** The single identity store (UserName -> Role mappings). */
    identityStore: InMemoryIdentityMappingStore;
    /** The server `userManager` to pass to the `OPCUAServer` constructor. */
    userManager: IManagedUserManager;
    /**
     * Install the RoleSet + User Management Methods on the running server,
     * bound to the same two stores. Call **after** `server.start()`.
     */
    install(
        server: IServerForRoleSet & IServerForUserManagement,
        options?: InstallRoleBasedSecurityOptions
    ): Promise<{ roleSet: InstallRoleSetResult; userManagement: InstallUserManagementResult }>;
}

const userNameRule = (userName: string): IdentityMappingRuleType =>
    new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: userName });

/**
 * Create the shared stores and the `userManager` bridge, seeding any initial
 * users and their Roles. Pass `userManager` to the `OPCUAServer` constructor,
 * then call {@link RoleBasedSecurity.install} after `server.start()`.
 */
export function createRoleBasedSecurity(options?: CreateRoleBasedSecurityOptions): RoleBasedSecurity {
    const userStore = new InMemoryUserManagementStore(options?.policy);
    const identityStore = new InMemoryIdentityMappingStore();

    for (const user of options?.users ?? []) {
        userStore.addUser(
            user.userName,
            user.password,
            user.userConfiguration ?? UserConfigurationMask.None,
            user.description ?? ""
        );
        for (const role of user.roles ?? []) {
            identityStore.addIdentity(role, userNameRule(user.userName));
        }
    }

    const userManager = createUserManager(userStore, identityStore);

    return {
        userStore,
        identityStore,
        userManager,
        async install(server, installOptions) {
            // one coordinator shared by both installers (so users + roles land in one file)
            const persistence =
                installOptions?.persistence ??
                (installOptions?.persistencePath
                    ? new ArchiveStore(installOptions.persistencePath, { secret: installOptions.persistenceSecret })
                    : undefined);

            const roleSet = await installRoleSet(server, { store: identityStore, persistence });
            const userManagement = await installUserManagement(server, { store: userStore, persistence });
            return { roleSet, userManagement };
        }
    };
}
