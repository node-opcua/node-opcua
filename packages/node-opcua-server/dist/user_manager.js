import { types } from "node:util";
import { make_errorLog } from "node-opcua-debug";
const errorLog = make_errorLog("user_manager");
export class UAUserManagerBase {
    getUserRoles(_user) {
        throw new Error("Method not implemented.");
    }
    isValidUser(_session, _username, _password) {
        throw new Error("Method not implemented.");
    }
    getIdentitiesForRole(_role) {
        return [];
    }
    bind(_roleSet) {
        /**  */
    }
}
export class UAUserManager1 extends UAUserManagerBase {
    options;
    constructor(options) {
        super();
        this.options = options;
    }
    getUserRoles(user) {
        if (!this.options.getUserRoles)
            return [];
        try {
            return this.options.getUserRoles(user);
        }
        catch (err) {
            if (types.isNativeError(err)) {
                errorLog("[NODE-OPCUA-E27] userManager provided getUserRoles method has thrown an exception, please fix your code! ");
                errorLog(err.message, "\n", err.stack?.split("\n").slice(0, 2).join("\n"));
            }
            return [];
        }
    }
    async isValidUser(session, username, password) {
        if (typeof this.options.isValidUserAsync === "function") {
            return new Promise((resolve, reject) => {
                this.options.isValidUserAsync?.call(session, username, password, (err, isAuthorized) => {
                    if (err)
                        return reject();
                    resolve(!!isAuthorized);
                });
            });
        }
        else if (typeof this.options.isValidUser === "function") {
            try {
                const authorized = this.options.isValidUser?.call(session, username, password);
                return authorized;
            }
            catch (err) {
                if (types.isNativeError(err)) {
                    errorLog("[NODE-OPCUA-E26] userManager provided isValidUser method has thrown an exception, please fix your code!");
                    errorLog(err.message, "\n", err.stack?.split("\n").slice(0, 2).join("\n"));
                }
                return false;
            }
        }
        else {
            return false;
        }
    }
    getIdentitiesForRole(role) {
        if (!this.options.getIdentitiesForRole)
            return [];
        try {
            return this.options.getIdentitiesForRole(role);
        }
        catch (err) {
            if (types.isNativeError(err)) {
                errorLog("[NODE-OPCUA-E29] userManager provided getIdentitiesForRole method has thrown an exception, please fix your code!");
                errorLog(err.message, "\n", err.stack?.split("\n").slice(0, 2).join("\n"));
            }
            return [];
        }
    }
}
export function makeUserManager(options) {
    if (options instanceof UAUserManagerBase) {
        return options;
    }
    options = options || {};
    if (typeof options.isValidUser !== "function") {
        options.isValidUser = ( /*userName,password*/) => {
            return false;
        };
    }
    return new UAUserManager1(options);
}
//# sourceMappingURL=user_manager.js.map