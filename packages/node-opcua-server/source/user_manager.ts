import { types } from "util";
import { IUserManager, UARoleSet } from "node-opcua-address-space";
import { NodeId } from "node-opcua-nodeid";
import { IdentityMappingRuleType } from "node-opcua-types";
import { make_errorLog } from "node-opcua-debug";
import { ServerSession } from "./server_session";

const errorLog = make_errorLog(__filename);

export type ValidUserFunc = (this: ServerSession, username: string, password: string) => boolean;
export type ValidUserAsyncFunc = (
    this: ServerSession,
    username: string,
    password: string,
    callback: (err: Error | null, isAuthorized?: boolean) => void
) => void;

export interface IUserManagerEx extends IUserManager {
    /** synchronous function to check the credentials - can be overruled by isValidUserAsync */
    isValidUser?: ValidUserFunc;
    /** asynchronous function to check if the credentials - overrules isValidUser */
    isValidUserAsync?: ValidUserAsyncFunc;
}

export type UserManagerOptions = IUserManagerEx | UAUserManagerBase;

export interface IUAUserManager extends IUserManager {
    getUserRoles(user: string): NodeId[];
    isValidUser(session: ServerSession, username: string, password: string): Promise<boolean>;
    getIdentitiesForRole(role: NodeId): IdentityMappingRuleType[];
}

export abstract class UAUserManagerBase implements IUAUserManager {
    getUserRoles(user: string): NodeId[] {
        throw new Error("Method not implemented.");
    }
    isValidUser(session: ServerSession, username: string, password: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    getIdentitiesForRole(role: NodeId): IdentityMappingRuleType[] {
        return [];
    }
    bind(roleSet: UARoleSet): void {
        /**  */
    }
}
export class UAUserManager1 extends UAUserManagerBase {
    constructor(private options: IUserManagerEx) {
        super();
    }
    getUserRoles(user: string): NodeId[] {
        if (!this.options.getUserRoles) return [];
        try {
            return this.options.getUserRoles(user);
        } catch (err) {
            if (types.isNativeError(err)) {
                errorLog(
                    "[NODE-OPCUA-E27] userManager provided getUserRoles method has thrown an exception, please fix your code! "
                );
                errorLog(err.message, "\n", (err as Error).stack?.split("\n").slice(0,2).join("\n"));
            }
            return [];
        }
    }

    async isValidUser(session: ServerSession, username: string, password: string): Promise<boolean> {
        if (typeof this.options.isValidUserAsync === "function") {
            return new Promise<boolean>((resolve, reject) => {
                this.options.isValidUserAsync?.call(session, username, password, (err, isAuthorized) => {
                    if (err) return reject();
                    resolve(isAuthorized!);
                });
            });
        } else if (typeof this.options.isValidUser === "function") {
            try {
                const authorized = this.options.isValidUser!.call(session, username, password);
                return authorized;
            } catch (err) {
                if (types.isNativeError(err)) {
                    errorLog(
                        "[NODE-OPCUA-E26] userManager provided isValidUser method has thrown an exception, please fix your code!"
                    );
                    errorLog(err.message, "\n", (err as Error).stack?.split("\n").slice(0,2).join("\n"));
                }
                return false;
            }
        } else {
            return false;
        }
    }
    getIdentitiesForRole(role: NodeId): IdentityMappingRuleType[] {
        return [];
    }
}

export function makeUserManager(options?: UserManagerOptions): UAUserManagerBase {
    if (options instanceof UAUserManagerBase) {
        return options;
    }
    options = options || {};

    if (typeof options.isValidUser !== "function") {
        options.isValidUser = (/*userName,password*/) => {
            return false;
        };
    }
    return new UAUserManager1(options as IUserManagerEx);
}
