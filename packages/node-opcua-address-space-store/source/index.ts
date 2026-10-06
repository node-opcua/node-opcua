/**
 * @module node-opcua-address-space-store
 *
 * The compact store of an address space: nodes, references and strings kept in typed columns,
 * addressed by integer indexes. Nothing here is a node object; the address space builds those
 * on demand on top of the store.
 */
export { type BrowsedReference, type BrowseOptions, Browser, type RelativePathElement } from "./browser.js";
export { CompactStore, type CompactStoreOptions, packedKey } from "./compact_store.js";
export { NO_NODE, NodeIdIndex } from "./node_id_index.js";
export { NO_STRING, type NodeRecord, NodeStore } from "./node_store.js";
export { ReferenceTable } from "./reference_table.js";
export { ReferenceTypeHierarchy } from "./reference_type_hierarchy.js";
export { StringArena } from "./string_arena.js";
export { type StoredValue, ValueKind, ValueStore } from "./value_store.js";
