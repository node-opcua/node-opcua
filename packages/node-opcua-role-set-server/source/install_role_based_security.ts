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
 * const security = await createRoleBasedSecurity({
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
import { make_errorLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import {
    ArchiveStore,
    type HasherRegistry,
    InMemoryIdentityMappingStore,
    InMemoryUserManagementStore,
    type PasswordPolicy,
    type SerializedUserRecord,
    validateUserConfiguration
} from "node-opcua-role-set-common";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import { type InstallRoleSetResult, type IServerForRoleSet, installRoleSet } from "./install_role_set.js";
import {
    type InstallUserManagementResult,
    type IServerForUserManagement,
    installUserManagement
} from "./install_user_management.js";
import { createUserManager, type IManagedUserManager } from "./user_management_user_manager.js";

const errorLog = make_errorLog("RoleBasedSecurity");

/**
 * A user to seed, with the well-known/custom Roles it holds.
 *
 * Provide **either** a clear-text {@link password} **or** a pre-hashed
 * {@link passwordHash} (salted scrypt record from `serializeUser`) — the latter
 * lets you seed users without any clear text in config/version control.
 */
export interface RoleBasedUser {
    userName: string;
    /** Clear-text seed password. Provide this or {@link passwordHash}. */
    password?: string;
    /**
     * Pre-hashed seed (salted scrypt record produced offline by `serializeUser`
     * / `exportUsers`). Provide this or {@link password} — never both. Seeded
     * verbatim via `importUsers`, so no clear text is required.
     */
    passwordHash?: SerializedUserRecord;
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
    /**
     * Password-hashing registry. Omit for the default (scrypt hashes; bcrypt
     * verifies legacy credentials and is upgraded to scrypt on login). Inject a
     * custom {@link HasherRegistry} to add schemes (e.g. an external verifier).
     */
    registry?: HasherRegistry;
}

export interface InstallRoleBasedSecurityOptions {
    /** A shared archive coordinator. When omitted, one is built from `persistencePath`. */
    persistence?: ArchiveStore;
    /** Path to a single consolidated archive for roles + users. */
    persistencePath?: string;
    /** Encrypt that archive at rest (AES-256-GCM, key derived from this secret). */
    persistenceSecret?: string;
    /**
     * Install the `UserManagement` Object (OPC 10000-18 §5). Default `true`.
     *
     * Set `false` to model a server that implements the RoleSet — roles and
     * their identity mappings — **without** the optional `UserManagement`
     * companion Object. That shape is common in the field, and it behaves
     * differently in a client in a way worth being able to test: `readUsers()`
     * answers with an *empty list* rather than failing, because there is no API
     * to enumerate accounts at all. A client cannot tell that apart from "this
     * server has no users" unless it looks for the Object.
     *
     * **Authentication is unaffected.** The `userManager` bridge still validates
     * credentials against the seeded user store and still resolves Roles; only
     * the Object exposing user *administration* is left out. That is exactly the
     * real-world case: the server knows its users, but offers no way to list or
     * manage them over OPC UA.
     */
    userManagement?: boolean;
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
    ): Promise<{
        roleSet: InstallRoleSetResult;
        /** Absent when `userManagement: false` — there is nothing to return. */
        userManagement?: InstallUserManagementResult;
    }>;
}

const userNameRule = (userName: string): IdentityMappingRuleType =>
    new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: userName });

/**
 * Create the shared stores and the `userManager` bridge, seeding any initial
 * users and their Roles. Pass `userManager` to the `OPCUAServer` constructor,
 * then call {@link RoleBasedSecurity.install} after `server.start()`.
 */
export async function createRoleBasedSecurity(options?: CreateRoleBasedSecurityOptions): Promise<RoleBasedSecurity> {
    const userStore = new InMemoryUserManagementStore(
        options?.policy,
        options?.registry ? { registry: options.registry } : undefined
    );
    const identityStore = new InMemoryIdentityMappingStore();

    for (const user of options?.users ?? []) {
        // Exactly one of password / passwordHash — reject the ambiguous case up
        // front rather than silently preferring one (the docstring says "never
        // both"), so a misconfiguration is loud instead of a silent surprise.
        if (user.password !== undefined && user.passwordHash) {
            throw new Error(
                `RoleBasedUser "${user.userName}": provide either "password" (clear text) or "passwordHash" (pre-hashed record), not both.`
            );
        }
        if (user.passwordHash) {
            // Pre-hashed seed: import the credential record verbatim — no clear
            // text involved. `userName`/`userConfiguration`/`description` on the
            // RoleBasedUser take precedence over the record's own fields.
            const userConfiguration = user.userConfiguration ?? user.passwordHash.userConfiguration;
            // importUsers bypasses addUser's validation, so apply the same
            // UserConfigurationMask check here (e.g. MustChangePassword +
            // NoChangeByUser is an illegal combination — §5.2.3).
            const configError = validateUserConfiguration(userConfiguration);
            if (configError) {
                throw new Error(`RoleBasedUser "${user.userName}": invalid userConfiguration (${configError.name}).`);
            }
            userStore.importUsers?.([
                {
                    ...user.passwordHash,
                    userName: user.userName,
                    userConfiguration,
                    description: user.description ?? user.passwordHash.description
                }
            ]);
        } else if (user.password !== undefined) {
            await userStore.addUser(
                user.userName,
                user.password,
                user.userConfiguration ?? UserConfigurationMask.None,
                user.description ?? ""
            );
        } else {
            throw new Error(
                `RoleBasedUser "${user.userName}": provide either "password" (clear text) or "passwordHash" (pre-hashed record).`
            );
        }
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

            // Persist upgrade-on-login re-hashes (e.g. bcrypt → scrypt) so the
            // migration sticks across restarts.
            if (persistence) {
                userStore.setOnCredentialUpgraded?.(() => {
                    // Background flush: a failed save must not surface as a
                    // process-level unhandled rejection. The upgraded credential
                    // is already live in memory; it will be re-persisted on the
                    // next login/mutation, so log and move on.
                    persistence.save().catch((err) => {
                        // Log the message only — a minified/obfuscated stack is noise.
                        errorLog(
                            "createRoleBasedSecurity: failed to persist credential upgrade:",
                            err instanceof Error ? err.message : err
                        );
                    });
                });
            }

            const roleSet = await installRoleSet(server, { store: identityStore, persistence });
            if (installOptions?.userManagement === false) {
                // Deliberately no UserManagement Object. Credentials still work:
                // the userManager bridge authenticates from userStore either way.
                return { roleSet };
            }
            const userManagement = await installUserManagement(server, { store: userStore, persistence });
            return { roleSet, userManagement };
        }
    };
}
