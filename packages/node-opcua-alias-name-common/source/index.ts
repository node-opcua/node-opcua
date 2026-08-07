/**
 * @module node-opcua-alias-name-common
 *
 * Shared building blocks for OPC 10000-17 (AliasNames).
 *
 * The OPC 10000-4 `Like` matcher used by `FindAlias` lives in
 * `node-opcua-like-matcher` and is re-exported below.
 *
 * These packages let a Server publish **its own** AliasNames and let a Client
 * consume them. Aggregating AliasNames collected from other Servers (Annex B
 * and Annex C) and the Annex D PubSub change notification are out of scope.
 */

export type { AliasEntry, AliasQuery, IAliasStore } from "./alias_store.js";
/**
 * The OPC 10000-4 `Like` matcher, re-exported so Part 17 consumers have one
 * import. It lives in `node-opcua-like-matcher` because `Like` is a Part 4
 * primitive that `QueryApplications` (OPC 10000-12) and event filter
 * ContentFilters also need, and neither should have to depend on the AliasName
 * package to get a dependency-free string matcher.
 */
export {
    DEFAULT_MAX_PATTERN_LENGTH,
    InvalidLikePatternError,
    isValidLikePattern,
    like,
    LikePattern,
    type LikeOptions
} from "node-opcua-like-matcher";
export {
    fromVersionTime,
    maxVersionTime,
    nowVersionTime,
    toVersionTime,
    VERSION_TIME_EPOCH_MS,
    VERSION_TIME_WRAP_DATE
} from "./version_time.js";
