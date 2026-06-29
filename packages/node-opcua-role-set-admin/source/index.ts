/**
 * @module node-opcua-role-set-admin
 *
 * Programmatic API behind the `role-set-admin` CLI. Import these to script the
 * same RoleSet / User Management administration from your own code.
 */
export {
    addIdentity,
    addRole,
    addUser,
    changePassword,
    type GlobalOpts,
    listRoles,
    listUsers,
    removeIdentity,
    removeRole,
    removeUser,
    showRole,
    withSession
} from "./commands.js";
