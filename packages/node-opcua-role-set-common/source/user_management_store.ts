/**
 * @module node-opcua-role-set-common
 *
 * User management store (OPC 10000-18 §5) — provides the local user list and
 * password lifecycle used by the `UserName` identity criteria.
 *
 * The store implements the behaviour of the AddUser / ModifyUser / RemoveUser
 * / ChangePassword Methods and the password policy (PasswordLength range and
 * the password-option requirements). Passwords are never stored in clear:
 * each is salted and hashed with scrypt.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";

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
 * Persisted user record — includes the salted scrypt hash (base64), never the
 * clear password. Suitable for storing in the consolidated archive.
 */
export interface SerializedUserRecord {
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
    addUser(userName: string, password: string, userConfiguration: UserConfigurationMask, description: string): StatusCode;
    modifyUser(userName: string, options: ModifyUserOptions, callerUserName?: string): StatusCode;
    removeUser(userName: string, callerUserName?: string): StatusCode;
    changePassword(userName: string, oldPassword: string, newPassword: string): StatusCode;
    authenticate(userName: string, password: string): AuthenticationResult;
    getUsers(): UserRecord[];
    hasUser(userName: string): boolean;
    /** Export every user (with salted hash) for persistence. Optional: only stores that support persistence. */
    exportUsers?(): SerializedUserRecord[];
    /** Load persisted users (with salted hash), replacing any existing entry of the same name. */
    importUsers?(records: SerializedUserRecord[]): void;
}

interface InternalUser {
    userName: string;
    salt: Buffer;
    hash: Buffer;
    userConfiguration: UserConfigurationMask;
    description: string;
}

const has = (mask: UserConfigurationMask, bit: UserConfigurationMask): boolean => (mask & bit) === bit;

/**
 * In-memory implementation of {@link IUserManagementStore}.
 *
 * @see OPC 10000-18 §5.2
 */
export class InMemoryUserManagementStore implements IUserManagementStore {
    private readonly _users = new Map<string, InternalUser>();
    private readonly _policy: PasswordPolicy;

    constructor(policy?: PasswordPolicy) {
        this._policy = policy ?? {};
    }

    public get policy(): PasswordPolicy {
        return this._policy;
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
            salt: u.salt.toString("base64"),
            hash: u.hash.toString("base64"),
            userConfiguration: u.userConfiguration,
            description: u.description
        }));
    }

    public importUsers(records: SerializedUserRecord[]): void {
        for (const r of records) {
            this._users.set(r.userName, {
                userName: r.userName,
                salt: Buffer.from(r.salt, "base64"),
                hash: Buffer.from(r.hash, "base64"),
                userConfiguration: r.userConfiguration,
                description: r.description
            });
        }
    }

    public addUser(userName: string, password: string, userConfiguration: UserConfigurationMask, description: string): StatusCode {
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
        this._users.set(userName, { userName, ...this.hashPassword(password), userConfiguration, description });
        return StatusCodes.Good;
    }

    public modifyUser(userName: string, options: ModifyUserOptions, callerUserName?: string): StatusCode {
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
            const { salt, hash } = this.hashPassword(options.password ?? "");
            user.salt = salt;
            user.hash = hash;
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

    public changePassword(userName: string, oldPassword: string, newPassword: string): StatusCode {
        const user = this._users.get(userName);
        // Unknown user is treated as an invalid old password (§5.2.8)
        if (!user) {
            return StatusCodes.BadIdentityTokenInvalid;
        }
        if (has(user.userConfiguration, UserConfigurationMask.NoChangeByUser)) {
            return StatusCodes.BadNotSupported;
        }
        if (!this.verify(user, oldPassword)) {
            return StatusCodes.BadIdentityTokenInvalid;
        }
        if (oldPassword === newPassword) {
            return StatusCodes.BadAlreadyExists;
        }
        if (!this.isPasswordValid(newPassword)) {
            return StatusCodes.BadOutOfRange;
        }
        const { salt, hash } = this.hashPassword(newPassword);
        user.salt = salt;
        user.hash = hash;
        // A successful change clears the MustChangePassword flag (§5.2.8)
        user.userConfiguration &= ~UserConfigurationMask.MustChangePassword;
        return StatusCodes.Good;
    }

    public authenticate(userName: string, password: string): AuthenticationResult {
        const user = this._users.get(userName);
        // A disabled user behaves like a user that does not exist (§5.2.3)
        if (!user || has(user.userConfiguration, UserConfigurationMask.Disabled)) {
            return { statusCode: StatusCodes.BadUserAccessDenied, mustChangePassword: false };
        }
        if (!this.verify(user, password)) {
            return { statusCode: StatusCodes.BadUserAccessDenied, mustChangePassword: false };
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

    private hashPassword(password: string): { salt: Buffer; hash: Buffer } {
        const salt = randomBytes(16);
        const hash = scryptSync(password, salt, 64);
        return { salt, hash };
    }

    private verify(user: InternalUser, password: string): boolean {
        const candidate = scryptSync(password, user.salt, 64);
        return candidate.length === user.hash.length && timingSafeEqual(candidate, user.hash);
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
