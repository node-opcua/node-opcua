/**
 * @module node-opcua-role-set-server
 *
 * Method handlers for the UserManagementType Methods (OPC 10000-18 §5.2):
 * AddUser, ModifyUser, RemoveUser and ChangePassword, backed by an
 * {@link IUserManagementStore}.
 *
 * AddUser / ModifyUser / RemoveUser require the SecurityAdmin Role and an
 * encrypted channel. ChangePassword is callable by the Session user itself but
 * still requires an encrypted channel and a USERNAME user token (§5.2.8).
 */
import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { IUserManagementStore } from "node-opcua-role-set-common";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { UserNameIdentityToken } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";
import { asBoolean, asMask, asString } from "./variant_args.js";

/**
 * Details of a user-management change for {@link BindUserManagementOptions.onAudit}.
 * Deliberately carries **no password** — only who did what to whom and the result —
 * so an AuditUpdateMethodEventType can be raised without leaking secrets.
 */
export interface UserManagementAudit {
    method: "AddUser" | "ModifyUser" | "RemoveUser" | "ChangePassword";
    /** The user the operation targets (the Session user for ChangePassword). */
    targetUserName: string;
    /** The Session user who invoked the Method. */
    callerUserName: string;
    methodNodeId: NodeId;
    statusCode: StatusCode;
}

export interface BindUserManagementOptions {
    store: IUserManagementStore;
    /** Called after every successful mutation so the caller can persist / refresh. */
    onMutation?: () => Promise<void>;
    /** Called after an authorized Method attempt to raise an audit event (no secrets). */
    onAudit?: (audit: UserManagementAudit) => void;
}

/** Create an AddUser Method handler (§5.2.5). */
export function makeAddUserHandler(options: BindUserManagementOptions) {
    const { store, onMutation, onAudit } = options;
    return async function _addUser(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const userName = asString(inputArguments[0]);
        const password = asString(inputArguments[1]);
        if (userName === null || password === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        const userConfiguration = asMask(inputArguments[2]);
        const description = asString(inputArguments[3]) ?? "";

        const statusCode = store.addUser(userName, password, userConfiguration, description);
        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "AddUser",
            targetUserName: userName,
            callerUserName: context.getUserName(),
            methodNodeId: this.nodeId,
            statusCode
        });
        return { statusCode };
    };
}

/** Create a ModifyUser Method handler (§5.2.6). */
export function makeModifyUserHandler(options: BindUserManagementOptions) {
    const { store, onMutation, onAudit } = options;
    return async function _modifyUser(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const userName = asString(inputArguments[0]);
        if (userName === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        const statusCode = store.modifyUser(
            userName,
            {
                modifyPassword: asBoolean(inputArguments[1]),
                password: asString(inputArguments[2]) ?? "",
                modifyUserConfiguration: asBoolean(inputArguments[3]),
                userConfiguration: asMask(inputArguments[4]),
                modifyDescription: asBoolean(inputArguments[5]),
                description: asString(inputArguments[6]) ?? ""
            },
            context.getUserName()
        );
        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "ModifyUser",
            targetUserName: userName,
            callerUserName: context.getUserName(),
            methodNodeId: this.nodeId,
            statusCode
        });
        return { statusCode };
    };
}

/** Create a RemoveUser Method handler (§5.2.7). */
export function makeRemoveUserHandler(options: BindUserManagementOptions) {
    const { store, onMutation, onAudit } = options;
    return async function _removeUser(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;
        const denied = checkSecurityAdminAccess(context);
        if (denied) return denied;

        const userName = asString(inputArguments[0]);
        if (userName === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        const statusCode = store.removeUser(userName, context.getUserName());
        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "RemoveUser",
            targetUserName: userName,
            callerUserName: context.getUserName(),
            methodNodeId: this.nodeId,
            statusCode
        });
        return { statusCode };
    };
}

/**
 * Create a ChangePassword Method handler (§5.2.8).
 *
 * Operates on the Session user, requires an encrypted channel and a USERNAME
 * user token (`Bad_InvalidState` otherwise). Does **not** require SecurityAdmin.
 */
export function makeChangePasswordHandler(options: BindUserManagementOptions) {
    const { store, onMutation, onAudit } = options;
    return async function _changePassword(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const insecure = checkEncryptedChannel(context);
        if (insecure) return insecure;

        const token = context.session?.userIdentityToken;
        if (!(token instanceof UserNameIdentityToken)) {
            return { statusCode: StatusCodes.BadInvalidState };
        }
        const userName = token.userName ?? "";

        const oldPassword = asString(inputArguments[0]);
        const newPassword = asString(inputArguments[1]);
        if (oldPassword === null || newPassword === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        const statusCode = store.changePassword(userName, oldPassword, newPassword);
        if (statusCode === StatusCodes.Good && onMutation) {
            await onMutation();
        }
        onAudit?.({
            method: "ChangePassword",
            targetUserName: userName,
            callerUserName: userName,
            methodNodeId: this.nodeId,
            statusCode
        });
        return { statusCode };
    };
}
