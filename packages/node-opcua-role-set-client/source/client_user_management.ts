/**
 * @module node-opcua-role-set-client
 *
 * Client-side wrapper for the server `UserManagement` Object (OPC 10000-18 §5).
 *
 * Resolves the AddUser / ModifyUser / RemoveUser / ChangePassword Method
 * NodeIds via `translateBrowsePath` (cached on first use), so the same code
 * drives a remote `ClientSession` and an in-process `PseudoSession`.
 */
import { ObjectIds } from "node-opcua-constants";
import { AttributeIds } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { CallMethodResult } from "node-opcua-service-call";
import { type BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { type UserConfigurationMask, UserManagementDataType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

/** Options for {@link ClientUserManagement.modifyUser}. */
export interface ModifyUserArgs {
    password?: string;
    userConfiguration?: UserConfigurationMask;
    description?: string;
}

interface UserManagementMethodIds {
    addUser: NodeId | null;
    modifyUser: NodeId | null;
    removeUser: NodeId | null;
    changePassword: NodeId | null;
    users: NodeId | null;
}

const NOT_SUPPORTED = () => new CallMethodResult({ statusCode: StatusCodes.BadNotSupported });

/**
 * Client-side entry point for the server `UserManagement` Object.
 *
 * ```ts
 * const um = new ClientUserManagement(session);
 * await um.addUser("joe", "Secret123!", UserConfigurationMask.None, "Joe");
 * await um.changePassword("Secret123!", "NewSecret456!");
 * ```
 */
export class ClientUserManagement {
    public readonly session: IBasicSessionAsync;
    public readonly userManagementNodeId: NodeId;
    private _ids?: UserManagementMethodIds;

    constructor(session: IBasicSessionAsync) {
        this.session = session;
        this.userManagementNodeId = resolveNodeId(ObjectIds.UserManagement);
    }

    private async ensureInitialized(): Promise<UserManagementMethodIds> {
        if (this._ids) return this._ids;
        const paths: BrowsePath[] = [
            makeBrowsePath(this.userManagementNodeId, "/AddUser"),
            makeBrowsePath(this.userManagementNodeId, "/ModifyUser"),
            makeBrowsePath(this.userManagementNodeId, "/RemoveUser"),
            makeBrowsePath(this.userManagementNodeId, "/ChangePassword"),
            makeBrowsePath(this.userManagementNodeId, "/Users")
        ];
        const r = await this.session.translateBrowsePath(paths);
        const target = (i: number): NodeId | null => (r[i].statusCode.isGood() && r[i].targets ? r[i].targets[0].targetId : null);
        this._ids = {
            addUser: target(0),
            modifyUser: target(1),
            removeUser: target(2),
            changePassword: target(3),
            users: target(4)
        };
        return this._ids;
    }

    /** Add a user (§5.2.5). Requires SecurityAdmin + an encrypted channel. */
    public async addUser(
        userName: string,
        password: string,
        userConfiguration: UserConfigurationMask,
        description = ""
    ): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.addUser) return NOT_SUPPORTED();
        return this.session.call({
            objectId: this.userManagementNodeId,
            methodId: ids.addUser,
            inputArguments: [
                new Variant({ dataType: DataType.String, value: userName }),
                new Variant({ dataType: DataType.String, value: password }),
                new Variant({ dataType: DataType.UInt32, value: userConfiguration }),
                new Variant({ dataType: DataType.String, value: description })
            ]
        });
    }

    /** Modify a user (§5.2.6). Only the provided fields are changed. */
    public async modifyUser(userName: string, changes: ModifyUserArgs): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.modifyUser) return NOT_SUPPORTED();
        return this.session.call({
            objectId: this.userManagementNodeId,
            methodId: ids.modifyUser,
            inputArguments: [
                new Variant({ dataType: DataType.String, value: userName }),
                new Variant({ dataType: DataType.Boolean, value: changes.password !== undefined }),
                new Variant({ dataType: DataType.String, value: changes.password ?? "" }),
                new Variant({ dataType: DataType.Boolean, value: changes.userConfiguration !== undefined }),
                new Variant({ dataType: DataType.UInt32, value: changes.userConfiguration ?? 0 }),
                new Variant({ dataType: DataType.Boolean, value: changes.description !== undefined }),
                new Variant({ dataType: DataType.String, value: changes.description ?? "" })
            ]
        });
    }

    /** Remove a user (§5.2.7). */
    public async removeUser(userName: string): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.removeUser) return NOT_SUPPORTED();
        return this.session.call({
            objectId: this.userManagementNodeId,
            methodId: ids.removeUser,
            inputArguments: [new Variant({ dataType: DataType.String, value: userName })]
        });
    }

    /** Change the Session user's password (§5.2.8). */
    public async changePassword(oldPassword: string, newPassword: string): Promise<CallMethodResult> {
        const ids = await this.ensureInitialized();
        if (!ids.changePassword) return NOT_SUPPORTED();
        return this.session.call({
            objectId: this.userManagementNodeId,
            methodId: ids.changePassword,
            inputArguments: [
                new Variant({ dataType: DataType.String, value: oldPassword }),
                new Variant({ dataType: DataType.String, value: newPassword })
            ]
        });
    }

    /** Read the configured users from the `Users` Property. */
    public async readUsers(): Promise<UserManagementDataType[]> {
        const ids = await this.ensureInitialized();
        if (!ids.users) return [];
        const dataValue = await this.session.read({ nodeId: ids.users, attributeId: AttributeIds.Value });
        const value = dataValue.value?.value;
        if (Array.isArray(value)) {
            return value.filter((v: unknown) => v instanceof UserManagementDataType);
        }
        return [];
    }
}
