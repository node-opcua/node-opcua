/**
 * @module node-opcua-role-set-server
 */

export { type AuditMethodEventFields, raiseAuditMethodEvent } from "./audit.js";
export {
    type BindRestrictionMethodsOptions,
    makeAddApplicationHandler,
    makeAddEndpointHandler,
    makeRemoveApplicationHandler,
    makeRemoveEndpointHandler
} from "./bind_restriction_methods.js";
export {
    type BindRoleMethodsOptions,
    makeAddIdentityHandler,
    makeRemoveIdentityHandler,
    type RoleMappingRuleChangedAudit
} from "./bind_role_methods.js";
export {
    type BindUserManagementOptions,
    makeAddUserHandler,
    makeChangePasswordHandler,
    makeModifyUserHandler,
    makeRemoveUserHandler,
    type UserManagementAudit
} from "./bind_user_management.js";
export {
    type CreateRoleBasedSecurityOptions,
    createRoleBasedSecurity,
    type InstallRoleBasedSecurityOptions,
    type RoleBasedSecurity,
    type RoleBasedUser
} from "./install_role_based_security.js";
export {
    type InstallRoleSetOptions,
    type InstallRoleSetResult,
    type IServerForRoleSet,
    installRoleSet
} from "./install_role_set.js";
export {
    type InstallUserManagementOptions,
    type InstallUserManagementResult,
    type IServerForUserManagement,
    installUserManagement
} from "./install_user_management.js";
export { RoleSetResolver } from "./role_set_resolver.js";
export { checkEncryptedChannel, checkSecurityAdminAccess } from "./security_checks.js";
export { createUserManager, type IManagedUserManager } from "./user_management_user_manager.js";
