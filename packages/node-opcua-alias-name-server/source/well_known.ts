/**
 * @module node-opcua-alias-name-server
 *
 * The fixed NodeIds of OPC 10000-17.
 *
 * Every well-known instance is resolved **by NodeId**, never by walking
 * BrowseNames. Clause 9.1 gives these Objects static NodeIds precisely so they
 * can be found without browsing, and a BrowseName walk would break on a Server
 * that publishes the hierarchy under a localised DisplayName or that has a
 * vendor Object of the same BrowseName elsewhere.
 */

import { DataTypeIds, MethodIds, ObjectIds, ObjectTypeIds, ReferenceTypeIds, VariableIds } from "node-opcua-constants";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";

/**
 * Default result cap; beyond it a call answers `Bad_ResponseTooLarge`
 * (clause 6.3.2 Table 4).
 *
 * Lives here rather than in `install_alias_names` so that `bind_alias_category`
 * can use it without the two importing each other.
 */
export const DEFAULT_MAX_RESULTS = 1000;

/** `AliasNameType` ObjectType (clause 6.2). */
export const ALIAS_NAME_TYPE: NodeId = resolveNodeId(ObjectTypeIds.AliasNameType);

/** `AliasNameCategoryType` ObjectType (clause 6.3). */
export const ALIAS_NAME_CATEGORY_TYPE: NodeId = resolveNodeId(ObjectTypeIds.AliasNameCategoryType);

/** `VersionTime` DataType (OPC 10000-4 clause 7.43) - a UInt32 subtype. */
export const VERSION_TIME_DATA_TYPE: NodeId = resolveNodeId(DataTypeIds.VersionTime);

/** `AliasFor` ReferenceType (clause 8.2); the default link to a target Node. */
export const ALIAS_FOR: NodeId = resolveNodeId(ReferenceTypeIds.AliasFor);

/** `PublishedDataSetType` (OPC 10000-14), the target type `Topics` restricts to. */
export const PUBLISHED_DATA_SET_TYPE: NodeId = resolveNodeId(ObjectTypeIds.PublishedDataSetType);

/** The three well-known category instances of clauses 9.2, 9.3 and 9.4. */
export const WellKnownCategories = {
    /** `Aliases`, the root of the hierarchy (clause 9.2). */
    Aliases: resolveNodeId(ObjectIds.Aliases),
    /** `TagVariables`; targets restricted to Variables (clause 9.3). */
    TagVariables: resolveNodeId(ObjectIds.TagVariables),
    /** `Topics`; targets restricted to PublishedDataSetType (clause 9.4). */
    Topics: resolveNodeId(ObjectIds.Topics)
} as const;

/** `LastChange` on each well-known category (clause 6.3.1). */
export const WellKnownLastChange = {
    Aliases: resolveNodeId(VariableIds.Aliases_LastChange),
    TagVariables: resolveNodeId(VariableIds.TagVariables_LastChange),
    Topics: resolveNodeId(VariableIds.Topics_LastChange)
} as const;

/** The Method declarations on `AliasNameCategoryType`. */
export const MethodDeclarations = {
    FindAlias: resolveNodeId(MethodIds.AliasNameCategoryType_FindAlias),
    FindAliasVerbose: resolveNodeId(MethodIds.AliasNameCategoryType_FindAliasVerbose),
    AddAliasesToCategory: resolveNodeId(MethodIds.AliasNameCategoryType_AddAliasesToCategory),
    DeleteAliasesFromCategory: resolveNodeId(MethodIds.AliasNameCategoryType_DeleteAliasesFromCategory)
} as const;

/**
 * The NodeIds OPC 10000-17 reserves for the *optional* Methods on the three
 * well-known categories.
 *
 * The shipped `Opc.Ua.NodeSet2.xml` declares these Methods on
 * `AliasNameCategoryType` but does not instantiate them on `Aliases`,
 * `TagVariables` or `Topics` — yet upstream still assigns them fixed NodeIds.
 * When installation adds them it uses these rather than server-assigned ones,
 * so an aggregating Server sees the standard NodeId it expects.
 */
export const WellKnownOptionalMethods = {
    Aliases: {
        FindAliasVerbose: resolveNodeId(MethodIds.Aliases_FindAliasVerbose),
        AddAliasesToCategory: resolveNodeId(MethodIds.Aliases_AddAliasesToCategory),
        DeleteAliasesFromCategory: resolveNodeId(MethodIds.Aliases_DeleteAliasesFromCategory)
    },
    TagVariables: {
        FindAliasVerbose: resolveNodeId(MethodIds.TagVariables_FindAliasVerbose),
        AddAliasesToCategory: resolveNodeId(MethodIds.TagVariables_AddAliasesToCategory),
        DeleteAliasesFromCategory: resolveNodeId(MethodIds.TagVariables_DeleteAliasesFromCategory)
    },
    Topics: {
        FindAliasVerbose: resolveNodeId(MethodIds.Topics_FindAliasVerbose),
        AddAliasesToCategory: resolveNodeId(MethodIds.Topics_AddAliasesToCategory),
        DeleteAliasesFromCategory: resolveNodeId(MethodIds.Topics_DeleteAliasesFromCategory)
    }
} as const;

/**
 * The `ALIAS` ServerCapability identifier (OPC 10000-12 Annex D Table D.1).
 *
 * A Server that does not advertise this will never be found by anything looking
 * for alias-capable Servers, and nothing reports that failure. Part 17's prose
 * writes it `Alias`; Part 12 Annex D is the normative source and writes `ALIAS`,
 * matched case-insensitively.
 */
export const ALIAS_SERVER_CAPABILITY = "ALIAS";
