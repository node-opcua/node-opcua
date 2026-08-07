/**
 * @module node-opcua-alias-name-server
 *
 * Server-side OPC 10000-17 (AliasNames).
 *
 * Publishes **this Server's own** AliasNames. Aggregating AliasNames collected
 * from other Servers (Annex B, Annex C) and the Annex D PubSub change
 * notification are out of scope.
 */

export { AddressSpaceAliasStore, type AddressSpaceAliasStoreOptions } from "./address_space_alias_store.js";
export { AliasNameError, addAlias, findAlias, removeAlias, type AddAliasOptions } from "./add_alias.js";
export {
    addAliasCategory,
    bindAliasCategory,
    ensureOptionalMethod,
    findMethodByDeclaration,
    getInstalledAliasNames,
    type AddAliasCategoryOptions,
    type BindAliasCategoryOptions,
    type InstalledAliasNames
} from "./bind_alias_category.js";
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
    insertionOrderComparator,
    makeFindAliasHandler,
    type AliasComparator,
    type FindAliasBindingOptions
} from "./bind_find_alias.js";
export {
    DEFAULT_MAX_RESULTS,
    installAliasNames,
    installAliasNamesOnAddressSpace,
    type CategoryDiscovery,
    type IServerForAliasNames,
    type InstallAliasNamesOptions,
    type InstallAliasNamesResult
} from "./install_alias_names.js";
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
