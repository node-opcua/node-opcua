/**
 * @module node-opcua-like-matcher
 *
 * The OPC 10000-4 `Like` FilterOperator (clause 7.4.4, Table 120).
 *
 * A dependency-free string matcher, in its own package because `Like` is a
 * Part 4 primitive with several unrelated consumers: the `AliasNameSearchPattern`
 * of `FindAlias` (OPC 10000-17), the string filters of `QueryApplications`
 * (OPC 10000-12), and Part 4 event filter ContentFilters.
 */

export {
    DEFAULT_MAX_PATTERN_LENGTH,
    InvalidLikePatternError,
    isValidLikePattern,
    type LikeOptions,
    LikePattern,
    like
} from "./like_matcher.js";
