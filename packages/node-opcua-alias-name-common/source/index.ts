/**
 * @module node-opcua-alias-name-common
 *
 * Shared building blocks for OPC 10000-17 (AliasNames).
 *
 * These packages let a Server publish **its own** AliasNames and let a Client
 * consume them. Aggregating AliasNames collected from other Servers (Annex B
 * and Annex C) and the Annex D PubSub change notification are out of scope.
 */

export type { AliasEntry, AliasQuery, IAliasStore } from "./alias_store.js";
export {
    DEFAULT_MAX_PATTERN_LENGTH,
    InvalidLikePatternError,
    isValidLikePattern,
    like,
    LikePattern,
    type LikeOptions
} from "./like_matcher.js";
export {
    fromVersionTime,
    maxVersionTime,
    nowVersionTime,
    toVersionTime,
    VERSION_TIME_EPOCH_MS,
    VERSION_TIME_WRAP_DATE
} from "./version_time.js";
