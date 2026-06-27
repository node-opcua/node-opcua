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
export { WellKnownRoleIds, WellKnownRoles } from "./well_known_role_ids.js";
