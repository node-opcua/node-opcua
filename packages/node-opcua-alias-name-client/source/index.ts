/**
 * @module node-opcua-alias-name-client
 *
 * Client-side OPC 10000-17 (AliasNames).
 *
 * Resolves the AliasNames **a Server publishes about itself**. Aggregating
 * AliasNames collected from other Servers (Annexes B and C) and the Annex D
 * PubSub change notification are out of scope; {@link ServerIndexResolver}
 * covers the one cross-Server step a Client still has to make, turning the
 * `ServerIndex` of a returned `ExpandedNodeId` into a URI (Annex A).
 */

export {
    ALIASES_ROOT,
    type ClientAliasEntry,
    ClientAliasSet,
    type ClientAliasVerboseEntry,
    type FindAliasOptions,
    TAG_VARIABLES,
    TOPICS
} from "./client_alias_set.js";
export { AliasNameCallError, AliasNameMethodNotSupportedError } from "./errors.js";
export {
    type AliasReferenceTypeEntry,
    type ReadAliasReferenceTypesOptions,
    readAliasReferenceTypes
} from "./read_alias_reference_types.js";
export { LOCAL_SERVER_INDEX, ServerIndexResolver } from "./server_index_resolver.js";
