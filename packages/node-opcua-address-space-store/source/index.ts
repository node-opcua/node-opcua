/**
 * @module node-opcua-address-space-store
 *
 * The compact store of an address space: nodes, references and strings kept in typed columns,
 * addressed by integer indexes. Nothing here is a node object; the address space builds those
 * on demand on top of the store.
 */
export { AttributeReader, type AttributeValue, ReadStatus } from "./attribute_reader.js";
export { type BrowsedReference, type BrowseOptions, Browser, type RelativePathElement } from "./browser.js";
export { type Column, ColumnSpace, type ColumnType } from "./columns.js";
export {
    CompactStore,
    type CompactStoreOptions,
    NAMESPACE_DEFAULT_RESTRICTIONS,
    NAMESPACE_DEFAULT_ROLE_PERMISSIONS,
    packedKey,
    type SharedStoreDescriptor
} from "./compact_store.js";
export { DataTypeResolver, ResolvedType } from "./data_type_resolver.js";
export { NO_NODE, NodeIdIndex } from "./node_id_index.js";
export { NO_STRING, type NodeRecord, NodeStore, type RolePermissionEntry, type SharedNodeBuffers } from "./node_store.js";
export { ReferenceTable } from "./reference_table.js";
export { ReferenceTypeHierarchy } from "./reference_type_hierarchy.js";
export { SharedReadStatus, SharedStoreReader, type SharedValue } from "./shared_reader.js";
export { StringArena } from "./string_arena.js";
export { type SharedValueBuffers, type StoredValue, ValueKind, ValueStore } from "./value_store.js";
export { StoreAddressSpace, type StoreAddressSpaceOptions } from "./views/store_address_space.js";
export { attributeDataValue, deniedDataValue, valueDataValue } from "./views/store_data_value.js";
export type { StoreAddNodeOptions, StoreAddObjectOptions, StoreAddVariableOptions } from "./views/store_node_builder.js";
export { StoreNodeView, StoreReferenceView, type VariableBinding } from "./views/store_node_view.js";
export { StoreObjectView } from "./views/store_object_view.js";
export { type NamespacePermissionDefaults, StorePermissions, type UnresolvedPermissionPolicy } from "./views/store_permissions.js";
export { StoreServices } from "./views/store_services.js";
export { StoreVariableView } from "./views/store_variable_view.js";
