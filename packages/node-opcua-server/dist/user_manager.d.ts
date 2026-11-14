import type { IUserManager, UARoleSet } from "node-opcua-address-space";
import type { NodeId } from "node-opcua-nodeid";
import type { IdentityMappingRuleType } from "node-opcua-types";
import type { ServerSession } from "./server_session.js";
export type ValidUserFunc = (this: ServerSession, username: string, password: string) => boolean;
export type ValidUserAsyncFunc = (this: ServerSession, username: string, password: string, callback: (err: Error | null, isAuthorized?: boolean) => void) => void;
export interface IUserManagerEx extends IUserManager {
    /** synchronous function to check the credentials - can be overruled by isValidUserAsync */
    isValidUser?: ValidUserFunc;
    /** asynchronous function to check if the credentials - overrules isValidUser */
    isValidUserAsync?: ValidUserAsyncFunc;
    /** optional: the IdentityMappingRules for a Role (binds each Role's `Identities` Property) */
    getIdentitiesForRole?: (role: NodeId) => IdentityMappingRuleType[];
}
export type UserManagerOptions = IUserManagerEx | UAUserManagerBase;
export interface IUAUserManager extends IUserManager {
    getUserRoles(user: string): NodeId[];
    isValidUser(session: ServerSession, username: string, password: string): Promise<boolean>;
    getIdentitiesForRole(role: NodeId): IdentityMappingRuleType[];
}
export declare abstract class UAUserManagerBase implements IUAUserManager {
    getUserRoles(_user: string): NodeId[];
    isValidUser(_session: ServerSession, _username: string, _password: string): Promise<boolean>;
    getIdentitiesForRole(_role: NodeId): IdentityMappingRuleType[];
    bind(_roleSet: UARoleSet): void;
}
export declare class UAUserManager1 extends UAUserManagerBase {
    private options;
    constructor(options: IUserManagerEx);
    getUserRoles(user: string): NodeId[];
    isValidUser(session: ServerSession, username: string, password: string): Promise<boolean>;
    getIdentitiesForRole(role: NodeId): IdentityMappingRuleType[];
}
export declare function makeUserManager(options?: UserManagerOptions): UAUserManagerBase;
//# sourceMappingURL=user_manager.d.ts.map