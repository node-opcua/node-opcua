"use strict";
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

function getUserName(userIdentityToken) {
    if (userIdentityToken.policyId === "anonymous") {
        return "anonymous";
    }
    assert(userIdentityToken.hasOwnProperty("userName"));
    return userIdentityToken.userName;
}




/**
 * @class SessionContext
 * @param options
 * @param [options.session=null] {Session}
 * @param [options.object=null] {Session}
 * @param [options.server=null] {OPCUAServer}
 * @constructor
 */
function SessionContext(options) {
    options = options || {};
    this.session = options.session;
    this.object = options.object;
    this.server = options.server;
}


/**
 * @method getCurrentUserRole
 * @return {String}
 */
SessionContext.prototype.getCurrentUserRole = function () {

    assert(this.session!=null,"expecting a session");
    assert(this.server !=null,"expecting a server");

    const userIdentityToken = this.session.userIdentityToken;

    const username = getUserName(userIdentityToken);

    if (username === "anonymous") {
        return "guest";
    }
    if (!this.server || !this.server.userManager) {
        return "default";
    }

    if (!_.isFunction(this.server.userManager.getUserRole)) {
        return "default";
    }
    return this.server.userManager.getUserRole(username);
};

/**
 * @method checkPermission
 * @param node
 * @param action
 * @return {Boolean}
 */
SessionContext.prototype.checkPermission = function (node, action) {

    assert(action === "CurrentRead" || action === "CurrentWrite");
    if (!node._permissions) {
        return node.userAccessLevel.has(action);
    }

    const permission = node._permissions[action];

    if (!permission) {
        return node.userAccessLevel.has(action);
    }

    const userRole = this.getCurrentUserRole();

    if (userRole === "default") {
        return node.userAccessLevel.has(action);
    }

    if (permission[0] === "*") {
        // accept all except...
        const str = "!" + userRole;
        if (permission.findIndex(function (x) {
              return x === str;
          }) >= 0) {
            return false; // user is explicitly denied
        }
        return true;
    } else {
        // deny all, unless specify
        if (permission.findIndex(function (x) {
              return x === userRole;
          }) >= 0) {
            return true; // user is explicitly denied
        }
        return false;
    }

};


SessionContext.prototype.queryUserAccess = function (node) {
    // to do
};
exports.SessionContext = SessionContext;

SessionContext.defaultContext = new SessionContext();
