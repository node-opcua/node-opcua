/**
 * @module node-opcua-role-set-server
 *
 * Install User Management (OPC 10000-18 §5) on an OPC UA server.
 *
 * Binds the AddUser / ModifyUser / RemoveUser / ChangePassword Methods of the
 * standard `UserManagement` Object (i=24290, ComponentOf ServerConfiguration)
 * to an {@link InMemoryUserManagementStore}, keeps the `Users` Property in sync
 * with the store, and publishes the password policy via `PasswordLength` /
 * `PasswordOptions`.
 */
import type { IAddressSpace, UAMethod, UAObject, UAVariable } from "node-opcua-address-space";
import { MethodIds, ObjectIds, VariableIds } from "node-opcua-constants";
import type { NodeId } from "node-opcua-nodeid";
import {
    ArchiveStore,
    InMemoryUserManagementStore,
    type IUserManagementStore,
    type PasswordPolicy
} from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { Range, UserManagementDataType, UserNameIdentityToken } from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { raiseAuditMethodEvent } from "./audit.js";
import {
    type BindUserManagementOptions,
    makeAddUserHandler,
    makeChangePasswordHandler,
    makeModifyUserHandler,
    makeRemoveUserHandler
} from "./bind_user_management.js";
import { hardenAdminOnly, hardenEncryptedOnly } from "./harden.js";

/** PasswordOptionsMask bit values (OPC 10000-18 §5.2.2). */
const PasswordOptions = {
    RequiresUpperCaseCharacters: 1 << 5,
    RequiresLowerCaseCharacters: 1 << 6,
    RequiresDigitCharacters: 1 << 7,
    RequiresSpecialCharacters: 1 << 8
} as const;

export interface InstallUserManagementOptions {
    /** Password policy published via PasswordLength / PasswordOptions and enforced by the store. */
    policy?: PasswordPolicy;
    /**
     * Existing user store to bind the Methods to. When omitted a new
     * {@link InMemoryUserManagementStore} is created. Inject a shared store when
     * the same store also backs the server `userManager`
     * (see `createUserManager`).
     */
    store?: IUserManagementStore;
    /**
     * A shared {@link ArchiveStore} coordinating one consolidated file across
     * `installRoleSet` and `installUserManagement`. Pass the **same** instance to
     * both so users (salted scrypt hashes) live in the same archive as the role
     * config; install order does not matter (unregistered sections are preserved).
     * When omitted, an internal one is created from `persistencePath`.
     */
    persistence?: ArchiveStore;
    /** Path to a users-only archive (used when no shared {@link persistence} is given). */
    persistencePath?: string;
    /** Encrypt the users-only archive at rest (see `installRoleSet`'s `persistenceSecret`). */
    persistenceSecret?: string;
}

export interface InstallUserManagementResult {
    store: IUserManagementStore;
}

/** A live session as seen by {@link IServerForUserManagement} — enough to identify and close it. */
export interface IActiveSession {
    readonly authenticationToken: NodeId;
    /** The activated user-identity token (a {@link UserNameIdentityToken} for username logins). */
    readonly userIdentityToken?: unknown;
}

/**
 * Minimal server shape: access to the address space, and — optionally — to the
 * live sessions so a disabled/removed user's sessions can be terminated
 * (§5.2.6-7). When `getSessions`/`closeSession` are absent (e.g. a bare test
 * double) the feature is silently skipped. The real `OPCUAServer`'s engine
 * provides both.
 */
export interface IServerForUserManagement {
    engine: {
        addressSpace: IAddressSpace | null;
        getSessions?(): IActiveSession[];
        closeSession?(authenticationToken: NodeId, deleteSubscriptions: boolean, reason: string): void;
    };
}

/**
 * Build a "close every active session of this user" function from the server's
 * engine, or `undefined` if the engine does not expose session control. Closing
 * deletes the user's subscriptions too — a deactivated user keeps nothing live.
 */
function makeSessionCloser(engine: IServerForUserManagement["engine"]): ((userName: string) => number) | undefined {
    const { getSessions, closeSession } = engine;
    if (!getSessions || !closeSession) return undefined;
    return (userName: string): number => {
        let closed = 0;
        // snapshot first: closeSession mutates the engine's session map
        for (const session of getSessions.call(engine)) {
            const token = session.userIdentityToken;
            if (token instanceof UserNameIdentityToken && token.userName === userName) {
                closeSession.call(engine, session.authenticationToken, /* deleteSubscriptions */ true, "Terminated");
                closed += 1;
            }
        }
        return closed;
    };
}

function passwordOptionsMask(policy: PasswordPolicy): number {
    let mask = 0;
    if (policy.requireUpperCase) mask |= PasswordOptions.RequiresUpperCaseCharacters;
    if (policy.requireLowerCase) mask |= PasswordOptions.RequiresLowerCaseCharacters;
    if (policy.requireDigit) mask |= PasswordOptions.RequiresDigitCharacters;
    if (policy.requireSpecial) mask |= PasswordOptions.RequiresSpecialCharacters;
    return mask;
}

/**
 * Install User Management on an OPC UA server.
 *
 * Call this **after** the server has started and the address space is
 * available (the standard nodeset must be loaded so the `UserManagement`
 * Object exists).
 */
export async function installUserManagement(
    server: IServerForUserManagement,
    options?: InstallUserManagementOptions
): Promise<InstallUserManagementResult> {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("installUserManagement: address space is not available. Call this after server.start().");
    }

    const userManagement = addressSpace.findNode(ObjectIds.UserManagement) as UAObject | null;
    if (!userManagement) {
        throw new Error("installUserManagement: UserManagement Object (i=24290) not found in address space.");
    }

    const policy = options?.policy ?? {};
    const store = options?.store ?? new InMemoryUserManagementStore(policy);

    // Consolidated-archive coordination: hydrate persisted users (salted hashes)
    // and register the `users` section so a shared coordinator persists them
    // alongside the role configuration.
    const persistence =
        options?.persistence ??
        (options?.persistencePath ? new ArchiveStore(options.persistencePath, { secret: options.persistenceSecret }) : undefined);
    if (persistence && store.importUsers) {
        const archive = await persistence.load();
        if (archive?.users) store.importUsers(archive.users);
    }
    const exportUsers = store.exportUsers?.bind(store);
    if (persistence && exportUsers) {
        persistence.setUsersProvider(() => exportUsers());
    }

    const usersVar = addressSpace.findNode(VariableIds.UserManagement_Users) as UAVariable | null;
    function refreshUsers(): void {
        usersVar?.setValueFromSource({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: store.getUsers().map(
                (u) =>
                    new UserManagementDataType({
                        userName: u.userName,
                        userConfiguration: u.userConfiguration,
                        description: u.description
                    })
            )
        });
    }

    // Raise an AuditUpdateMethodEventType on the Server object for each managed
    // user-management call — WITHOUT any password (only who/what/whom/result).
    const serverObject = addressSpace.rootFolder?.objects?.server;
    const closeSessionsForUser = makeSessionCloser(server.engine);
    const methodOptions: BindUserManagementOptions = {
        store,
        onMutation: async () => {
            refreshUsers();
            await persistence?.save();
        },
        onUserDeactivated: closeSessionsForUser
            ? (userName) => {
                  const closed = closeSessionsForUser(userName);
                  if (closed > 0) {
                      raiseAuditMethodEvent(serverObject, "AuditUpdateMethodEventType", {
                          sourceNode: userManagement.nodeId,
                          sourceName: "Method/UserDeactivated",
                          clientUserId: userName,
                          status: true,
                          message: `terminated ${closed} active session(s) of deactivated user '${userName}'`
                      });
                  }
              }
            : undefined,
        onAudit: (audit) => {
            raiseAuditMethodEvent(serverObject, "AuditUpdateMethodEventType", {
                sourceNode: userManagement.nodeId,
                sourceName: `Method/${audit.method}`,
                methodId: audit.methodNodeId,
                clientUserId: audit.callerUserName,
                status: audit.statusCode === StatusCodes.Good,
                message: `${audit.method}('${audit.targetUserName}') by '${audit.callerUserName}' → ${audit.statusCode.name}`
                // NOTE: inputArguments deliberately omitted — they contain passwords
            });
        }
    };

    // Bind and harden the Methods: the three administrative Methods (and the
    // Users list, which reveals account names) are SecurityAdmin-only over an
    // encrypted channel; ChangePassword stays callable by any authenticated user
    // but still requires encryption (§4.4.1 / §5.2.8).
    hardenAdminOnly(bindMethod(addressSpace, MethodIds.UserManagement_AddUser, makeAddUserHandler(methodOptions)));
    hardenAdminOnly(bindMethod(addressSpace, MethodIds.UserManagement_ModifyUser, makeModifyUserHandler(methodOptions)));
    hardenAdminOnly(bindMethod(addressSpace, MethodIds.UserManagement_RemoveUser, makeRemoveUserHandler(methodOptions)));
    hardenEncryptedOnly(
        bindMethod(addressSpace, MethodIds.UserManagement_ChangePassword, makeChangePasswordHandler(methodOptions))
    );
    hardenAdminOnly(usersVar);

    // Publish the password policy and the initial (empty) user list.
    const lengthVar = addressSpace.findNode(VariableIds.UserManagement_PasswordLength) as UAVariable | null;
    lengthVar?.setValueFromSource({
        dataType: DataType.ExtensionObject,
        value: new Range({ low: policy.minLength ?? 0, high: policy.maxLength ?? 0 })
    });

    const optionsVar = addressSpace.findNode(VariableIds.UserManagement_PasswordOptions) as UAVariable | null;
    optionsVar?.setValueFromSource({ dataType: DataType.UInt32, value: passwordOptionsMask(policy) });

    refreshUsers();

    return { store };
}

function bindMethod(
    addressSpace: IAddressSpace,
    methodNodeId: number,
    handler: Parameters<UAMethod["bindMethod"]>[0]
): UAMethod | null {
    const method = addressSpace.findNode(methodNodeId) as UAMethod | null;
    method?.bindMethod(handler);
    return method;
}
