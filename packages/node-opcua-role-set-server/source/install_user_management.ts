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
import { InMemoryUserManagementStore, type IUserManagementStore, type PasswordPolicy } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { Range, UserManagementDataType } from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { raiseAuditMethodEvent } from "./audit.js";
import {
    type BindUserManagementOptions,
    makeAddUserHandler,
    makeChangePasswordHandler,
    makeModifyUserHandler,
    makeRemoveUserHandler
} from "./bind_user_management.js";

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
     * (see `createUserManagementUserManager`).
     */
    store?: IUserManagementStore;
}

export interface InstallUserManagementResult {
    store: IUserManagementStore;
}

/** Minimal server shape: access to the address space. */
export interface IServerForUserManagement {
    engine: {
        addressSpace: IAddressSpace | null;
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
    const methodOptions: BindUserManagementOptions = {
        store,
        onMutation: async () => {
            refreshUsers();
        },
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

    bindMethod(addressSpace, MethodIds.UserManagement_AddUser, makeAddUserHandler(methodOptions));
    bindMethod(addressSpace, MethodIds.UserManagement_ModifyUser, makeModifyUserHandler(methodOptions));
    bindMethod(addressSpace, MethodIds.UserManagement_RemoveUser, makeRemoveUserHandler(methodOptions));
    bindMethod(addressSpace, MethodIds.UserManagement_ChangePassword, makeChangePasswordHandler(methodOptions));

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

function bindMethod(addressSpace: IAddressSpace, methodNodeId: number, handler: Parameters<UAMethod["bindMethod"]>[0]): void {
    const method = addressSpace.findNode(methodNodeId) as UAMethod | null;
    method?.bindMethod(handler);
}
