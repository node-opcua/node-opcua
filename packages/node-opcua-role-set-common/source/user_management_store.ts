/**
 * @module node-opcua-role-set-common
 *
 * User management store (OPC 10000-18 §5) — provides the local user list and
 * password lifecycle used by the `UserName` identity criteria.
 *
 * The store implements the behaviour of the AddUser / ModifyUser / RemoveUser
 * / ChangePassword Methods and the password policy (PasswordLength range and
 * the password-option requirements). Passwords are never stored in clear: each
 * is kept as a self-describing PHC credential string (scrypt by default; other
 * schemes such as bcrypt coexist and are migrated on login — see
 * {@link HasherRegistry}). Credential operations are **async** so an external
 * verifier (LDAP/argon2) can be plugged in without another interface change.
 */
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";

import { defaultHasherRegistry, type HasherRegistry, ScryptHasher, scryptPhc } from "./password_hasher.js";

/**
 * Password requirements (OPC 10000-18 §5.2.1-2: PasswordLength range and
 * PasswordOptionsMask). A length of 0 means "no limit".
 */
export interface PasswordPolicy {
    minLength?: number;
    maxLength?: number;
    requireUpperCase?: boolean;
    requireLowerCase?: boolean;
    requireDigit?: boolean;
    requireSpecial?: boolean;
}

/** Public view of a configured user (no secret material). */
export interface UserRecord {
    userName: string;
    userConfiguration: UserConfigurationMask;
    description: string;
}

/**
 * Persisted user record (archive v2) — the credential is a self-describing PHC
 * string (e.g. `$scrypt$…` / `$2b$…`), never a clear password. Suitable for
 * storing in the consolidated archive.
 */
export interface SerializedUserRecord {
    userName: string;
    /** PHC / modular-crypt credential string (scheme self-described by its prefix). */
    credential: string;
    userConfiguration: UserConfigurationMask;
    description: string;
}

/**
 * Legacy (archive v1) persisted record — raw scrypt `salt`+`hash` (base64).
 * Accepted by {@link IUserManagementStore.importUsers} and read-migrated to a
 * `$scrypt$…` {@link SerializedUserRecord} credential, so old archives keep
 * working with **no forced password resets**.
 */
export interface LegacySerializedUserRecord {
    userName: string;
    salt: string; // base64
    hash: string; // base64
    userConfiguration: UserConfigurationMask;
    description: string;
}

/** Result of authenticating a user at ActivateSession time. */
export interface AuthenticationResult {
    /** `Good`, `GoodPasswordChangeRequired`, or a `Bad_` code on failure. */
    statusCode: StatusCode;
    /** True when the user must change the password before gaining roles. */
    mustChangePassword: boolean;
}

export interface ModifyUserOptions {
    modifyPassword?: boolean;
    password?: string;
    modifyUserConfiguration?: boolean;
    userConfiguration?: UserConfigurationMask;
    modifyDescription?: boolean;
    description?: string;
}

export interface IUserManagementStore {
    addUser(userName: string, password: string, userConfiguration: UserConfigurationMask, description: string): Promise<StatusCode>;
    modifyUser(userName: string, options: ModifyUserOptions, callerUserName?: string): Promise<StatusCode>;
    removeUser(userName: string, callerUserName?: string): StatusCode;
    changePassword(userName: string, oldPassword: string, newPassword: string): Promise<StatusCode>;
    authenticate(userName: string, password: string): Promise<AuthenticationResult>;
    getUsers(): UserRecord[];
    hasUser(userName: string): boolean;
    /** Export every user (with its PHC credential) for persistence. Optional: only stores that support persistence. */
    exportUsers?(): SerializedUserRecord[];
    /** Load persisted users (v2 credential or legacy v1 salt+hash), replacing any existing entry of the same name. */
    importUsers?(records: readonly (SerializedUserRecord | LegacySerializedUserRecord)[]): void;
    /**
     * Optional: register a callback fired when a credential is transparently
     * re-hashed during {@link authenticate} (upgrade-on-login), so a persistence
     * layer can flush the new hash.
     */
    setOnCredentialUpgraded?(fn: (userName: string) => void): void;
}

interface InternalUser {
    userName: string;
    /** PHC credential string. */
    credential: string;
    userConfiguration: UserConfigurationMask;
    description: string;
}

const has = (mask: UserConfigurationMask, bit: UserConfigurationMask): boolean => (mask & bit) === bit;

/** A record is legacy (v1) when it carries raw `salt`+`hash` instead of a `credential`. */
function isLegacyRecord(r: SerializedUserRecord | LegacySerializedUserRecord): r is LegacySerializedUserRecord {
    return typeof (r as SerializedUserRecord).credential !== "string";
}

/** Shared default scrypt hasher used by the offline {@link serializeUser} helper. */
const offlineScrypt = new ScryptHasher();

/**
 * Produce a {@link SerializedUserRecord} (scrypt PHC credential) from a
 * clear-text password — **offline**, without a store.
 *
 * Use this to keep clear-text passwords out of version control / config: run it
 * once at deploy time and commit only the returned record, then seed it through
 * `importUsers` (or `createRoleBasedSecurity`'s `passwordHash`). The record is
 * interchangeable with what {@link InMemoryUserManagementStore.exportUsers}
 * produces, so `authenticate` accepts the original clear-text password.
 */
export async function serializeUser(
    userName: string,
    password: string,
    options?: { userConfiguration?: UserConfigurationMask; description?: string }
): Promise<SerializedUserRecord> {
    return {
        userName,
        credential: await offlineScrypt.hash(password),
        userConfiguration: options?.userConfiguration ?? UserConfigurationMask.None,
        description: options?.description ?? ""
    };
}

/**
 * Wrap an **already-hashed** PHC credential string (e.g. a legacy `$2b$…`
 * bcrypt hash) into a {@link SerializedUserRecord} — no clear text, no
 * re-hashing. The credential is verified by whichever registered scheme owns
 * its prefix, and (for non-default schemes) upgraded on next login.
 */
export function credentialRecord(
    userName: string,
    credential: string,
    options?: { userConfiguration?: UserConfigurationMask; description?: string }
): SerializedUserRecord {
    return {
        userName,
        credential,
        userConfiguration: options?.userConfiguration ?? UserConfigurationMask.None,
        description: options?.description ?? ""
    };
}

/**
 * In-memory implementation of {@link IUserManagementStore}.
 *
 * @see OPC 10000-18 §5.2
 */
export class InMemoryUserManagementStore implements IUserManagementStore {
    private readonly _users = new Map<string, InternalUser>();
    private readonly _policy: PasswordPolicy;
    private readonly _registry: HasherRegistry;
    private _onCredentialUpgraded?: (userName: string) => void;

    constructor(policy?: PasswordPolicy, options?: { registry?: HasherRegistry }) {
        this._policy = policy ?? {};
        this._registry = options?.registry ?? defaultHasherRegistry();
    }

    public get policy(): PasswordPolicy {
        return this._policy;
    }

    public setOnCredentialUpgraded(fn: (userName: string) => void): void {
        this._onCredentialUpgraded = fn;
    }

    public hasUser(userName: string): boolean {
        return this._users.has(userName);
    }

    public getUsers(): UserRecord[] {
        return [...this._users.values()].map((u) => ({
            userName: u.userName,
            userConfiguration: u.userConfiguration,
            description: u.description
        }));
    }

    public exportUsers(): SerializedUserRecord[] {
        return [...this._users.values()].map((u) => ({
            userName: u.userName,
            credential: u.credential,
            userConfiguration: u.userConfiguration,
            description: u.description
        }));
    }

    public importUsers(records: readonly (SerializedUserRecord | LegacySerializedUserRecord)[]): void {
        for (const r of records) {
            // v1 archives stored raw scrypt salt+hash — migrate to a $scrypt$ PHC
            // credential on read (lossless: same algorithm and parameters).
            const credential = isLegacyRecord(r) ? scryptPhc(r.salt, r.hash) : r.credential;
            this._users.set(r.userName, {
                userName: r.userName,
                credential,
                userConfiguration: r.userConfiguration,
                description: r.description
            });
        }
    }

    public async addUser(
        userName: string,
        password: string,
        userConfiguration: UserConfigurationMask,
        description: string
    ): Promise<StatusCode> {
        if (this._users.has(userName)) {
            return StatusCodes.BadAlreadyExists;
        }
        const configError = validateUserConfiguration(userConfiguration);
        if (configError) {
            return configError;
        }
        if (!this.isPasswordValid(password)) {
            return StatusCodes.BadOutOfRange;
        }
        const credential = await this._registry.hash(password);
        this._users.set(userName, { userName, credential, userConfiguration, description });
        return StatusCodes.Good;
    }

    public async modifyUser(userName: string, options: ModifyUserOptions, callerUserName?: string): Promise<StatusCode> {
        const user = this._users.get(userName);
        if (!user) {
            return StatusCodes.BadNotFound;
        }
        if (options.modifyPassword) {
            if (!this.isPasswordValid(options.password ?? "")) {
                return StatusCodes.BadOutOfRange;
            }
        }
        let nextConfig = user.userConfiguration;
        if (options.modifyUserConfiguration) {
            nextConfig = options.userConfiguration ?? UserConfigurationMask.None;
            const configError = validateUserConfiguration(nextConfig);
            if (configError) {
                return configError;
            }
            // Cannot disable the user that calls the Method (§5.2.6)
            if (
                callerUserName === userName &&
                has(nextConfig, UserConfigurationMask.Disabled) &&
                !has(user.userConfiguration, UserConfigurationMask.Disabled)
            ) {
                return StatusCodes.BadInvalidSelfReference;
            }
        }

        // All checks passed — apply the changes
        if (options.modifyPassword) {
            user.credential = await this._registry.hash(options.password ?? "");
        }
        if (options.modifyUserConfiguration) {
            user.userConfiguration = nextConfig;
        }
        if (options.modifyDescription) {
            user.description = options.description ?? "";
        }
        return StatusCodes.Good;
    }

    public removeUser(userName: string, callerUserName?: string): StatusCode {
        const user = this._users.get(userName);
        if (!user) {
            return StatusCodes.BadNotFound;
        }
        if (callerUserName === userName) {
            return StatusCodes.BadInvalidSelfReference;
        }
        if (has(user.userConfiguration, UserConfigurationMask.NoDelete)) {
            return StatusCodes.BadNotSupported;
        }
        this._users.delete(userName);
        return StatusCodes.Good;
    }

    public async changePassword(userName: string, oldPassword: string, newPassword: string): Promise<StatusCode> {
        const user = this._users.get(userName);
        // Unknown user is treated as an invalid old password (§5.2.8)
        if (!user) {
            return StatusCodes.BadIdentityTokenInvalid;
        }
        if (has(user.userConfiguration, UserConfigurationMask.NoChangeByUser)) {
            return StatusCodes.BadNotSupported;
        }
        if (!(await this._registry.verify(oldPassword, user.credential))) {
            return StatusCodes.BadIdentityTokenInvalid;
        }
        if (oldPassword === newPassword) {
            return StatusCodes.BadAlreadyExists;
        }
        if (!this.isPasswordValid(newPassword)) {
            return StatusCodes.BadOutOfRange;
        }
        user.credential = await this._registry.hash(newPassword);
        // A successful change clears the MustChangePassword flag (§5.2.8)
        user.userConfiguration &= ~UserConfigurationMask.MustChangePassword;
        return StatusCodes.Good;
    }

    public async authenticate(userName: string, password: string): Promise<AuthenticationResult> {
        const user = this._users.get(userName);
        // A disabled user behaves like a user that does not exist (§5.2.3)
        if (!user || has(user.userConfiguration, UserConfigurationMask.Disabled)) {
            return { statusCode: StatusCodes.BadUserAccessDenied, mustChangePassword: false };
        }
        if (!(await this._registry.verify(password, user.credential))) {
            return { statusCode: StatusCodes.BadUserAccessDenied, mustChangePassword: false };
        }
        // Upgrade-on-login: transparently re-hash a legacy/drifted credential with
        // the default scheme (e.g. bcrypt → scrypt) now that we hold the clear text.
        if (this._registry.needsRehash(user.credential)) {
            user.credential = await this._registry.hash(password);
            this._onCredentialUpgraded?.(userName);
        }
        if (has(user.userConfiguration, UserConfigurationMask.MustChangePassword)) {
            return { statusCode: StatusCodes.GoodPasswordChangeRequired, mustChangePassword: true };
        }
        return { statusCode: StatusCodes.Good, mustChangePassword: false };
    }

    /** Validate a candidate password against the configured policy. */
    public isPasswordValid(password: string): boolean {
        const p = this._policy;
        if (p.minLength && password.length < p.minLength) return false;
        if (p.maxLength && password.length > p.maxLength) return false;
        if (p.requireUpperCase && !/[A-Z]/.test(password)) return false;
        if (p.requireLowerCase && !/[a-z]/.test(password)) return false;
        if (p.requireDigit && !/[0-9]/.test(password)) return false;
        if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password)) return false;
        return true;
    }
}

/**
 * Validate a UserConfigurationMask combination (OPC 10000-18 §5.2.3):
 * MustChangePassword is invalid when NoChangeByUser is also set.
 *
 * @returns a `Bad_ConfigurationError` StatusCode, or `null` if valid.
 */
function validateUserConfiguration(mask: UserConfigurationMask): StatusCode | null {
    if (has(mask, UserConfigurationMask.MustChangePassword) && has(mask, UserConfigurationMask.NoChangeByUser)) {
        return StatusCodes.BadConfigurationError;
    }
    return null;
}
