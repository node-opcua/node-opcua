/**
 * @module node-opcua-uanodeset-json
 *
 * The nodeset serialisations of OPC 10000-6 Annex I, as formats the address-space loader can
 * read. Importing this module registers every one of them; importing a subpath registers only
 * that one, which is the point of the subpath.
 */

export { flattenAnnexIDocument } from "./internal/annex_i_flatten.js";
export { annexIHeaderRecord, annexINodeRecord } from "./internal/annex_i_to_records.js";
export * from "./internal/annex_i_types.js";
export { AnnexIValueError, decodeAnnexIVariant } from "./internal/annex_i_variant.js";
export {
    annexINamespaceTable,
    formatAnnexINodeId,
    formatAnnexIQualifiedName,
    OPCUA_CORE_NAMESPACE,
    parseAnnexINodeId,
    parseAnnexIQualifiedName
} from "./internal/canonical_nodeid.js";
export { isTar, readTar, type TarEntry, writeTar } from "./internal/tar.js";
export * from "./json/index.js";
export * from "./jsonl/index.js";
export * from "./uanodeset/index.js";
