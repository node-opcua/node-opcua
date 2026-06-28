/**
 * @module node-opcua-role-set-common
 */

export {
    decodeIdentityStore,
    encodeIdentityStore,
    identityStoreBinaryStoreSize,
    loadFromBinaryFile,
    saveToBinaryFile
} from "./binary_persistence.js";
export type { AnyUserIdentityToken, IIdentityMappingStore } from "./identity_mapping_store.js";
export { InMemoryIdentityMappingStore } from "./in_memory_store.js";
export {
    type AuthenticationResult,
    InMemoryUserManagementStore,
    type IUserManagementStore,
    type ModifyUserOptions,
    type PasswordPolicy,
    type UserRecord
} from "./user_management_store.js";
export { WellKnownRoleIds, WellKnownRoles } from "./well_known_role_ids.js";
export {
    canonicalizeX509Subject,
    certificateSubjectPairs,
    matchX509Subject,
    parseX509SubjectCriteria,
    X509_SUBJECT_ORDER,
    type X509SubjectName
} from "./x509_subject.js";
