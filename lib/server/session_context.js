var assert = require("assert");


function getUserName(userIdentityToken) {
    if (userIdentityToken.policyId === "anonymous") {
        return "anonymous";
    }
    assert(userIdentityToken.hasOwnProperty("userName"));
    return userIdentityToken.userName;
}




/**
 *
 * @param options
 * @constructor
 */
function SessionContext(options) {
    options = options || {};
    this.session = options.session;
    this.object = options.object;
    this.server = options.server;
}


SessionContext.prototype.getCurrentUserRole = function () {
    var userIdentityToken = this.session.userIdentityToken;
    var username = getUserName(userIdentityToken);

    if (username === "anonymous") {
        return "guest";
    }
    if (!this.session.userManager) {
        return "default";
    }
    if (!_.isFunction(this.session.userManager.getUserRole)) {
        return "default";
    }
    return this.session.userManager.getUserRole(username);
};

SessionContext.prototype.checkPermission = function (node, action) {

    assert(action === "CurrentRead" || action === "CurrentWrite");
    if (!node._permissions) {
        return node.userAccessLevel.has(action);
    }

    var permission = node._permissions[action];

    if (!permission) {
        return node.userAccessLevel.has(action);
    }

    var userRole = this.getCurrentUserRole();

    if (userRole === "default") {
        return node.userAccessLevel.has(action);
    }

    if (permission[0] === "*") {
        // accept all except...
        var str = "!" + userRole;
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
