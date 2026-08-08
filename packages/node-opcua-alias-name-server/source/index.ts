/**
 * @module node-opcua-alias-name-server
 *
 * Server-side OPC 10000-17 (AliasNames).
 *
 * Publishes **this Server's own** AliasNames. Aggregating AliasNames collected
 * from other Servers (Annex B, Annex C) and the Annex D PubSub change
 * notification are out of scope.
 */

export { type AddAliasOptions, AliasNameError, addAlias, findAlias, removeAlias } from "./add_alias.js";
export { AddressSpaceAliasStore, type AddressSpaceAliasStoreOptions } from "./address_space_alias_store.js";
export {
    aliasesOf,
    collectAllCategories,
    collectCategories,
    findAliasNameCategoryType,
    findAliasNameType,
    isAliasName,
    isAliasNameCategory,
    presentWellKnownCategories
} from "./alias_hierarchy.js";
export {
    ALIAS_NAME_ARCHIVE_VERSION,
    type AliasNameArchive,
    readAliasNameArchive,
    writeAliasNameArchive
} from "./alias_name_archive.js";
export {
    type AddAliasCategoryOptions,
    addAliasCategory,
    type BindAliasCategoryOptions,
    bindAliasCategory,
    ensureLastChangeProperty,
    ensureOptionalMethod,
    findMethodByDeclaration,
    getInstalledAliasNames,
    type InstalledAliasNames,
    removeAliasCategory
} from "./bind_alias_category.js";
export {
    type AliasComparator,
    type FindAliasBindingOptions,
    insertionOrderComparator,
    makeFindAliasHandler
} from "./bind_find_alias.js";
export {
    ALIAS_SERVER_CAPABILITY_ID,
    advertiseAliasCapability,
    type CategoryProvider,
    DEFAULT_MAX_RESULTS,
    defaultCategoryProvider,
    type InstallAliasNamesOptions,
    type InstallAliasNamesResult,
    type IServerForAliasNames,
    installAliasNames,
    installAliasNamesOnAddressSpace
} from "./install_alias_names.js";
export {
    LAST_CHANGE_BROWSE_NAME,
    LastChangeTracker,
    type LastChangeTrackerOptions
} from "./last_change.js";
export {
    ALIAS_FOR,
    ALIAS_NAME_CATEGORY_TYPE,
    ALIAS_NAME_TYPE,
    ALIAS_SERVER_CAPABILITY,
    MethodDeclarations,
    PUBLISHED_DATA_SET_TYPE,
    WellKnownCategories,
    WellKnownLastChange,
    WellKnownOptionalMethods
} from "./well_known.js";
