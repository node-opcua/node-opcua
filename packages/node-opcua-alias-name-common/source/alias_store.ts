/**
 * @module node-opcua-alias-name-common
 *
 * The data model shared by the AliasName server and client packages
 * (OPC 10000-17).
 */

import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";

/**
 * One AliasName and the Nodes it resolves to.
 *
 * This is the store-side shape behind `AliasNameDataType` (clause 7.2) and
 * `AliasNameVerboseDataType` (clause 7.3).
 */
export interface AliasEntry {
    /**
     * The string part of the AliasName only.
     *
     * Clause 6.2 requires a Client to *ignore the namespace* of an AliasName
     * when comparing it with another, so the namespace is deliberately not part
     * of the identity here. The namespace an alias is published in is a property
     * of the address-space node, not of the entry.
     */
    aliasName: string;

    /**
     * The namespace URI the AliasName was published in.
     *
     * Clause 6.2 requires a Client to ignore the namespace when *comparing*
     * AliasNames, which is why it is not part of the identity above — but a
     * Server should still report it truthfully rather than invent one. Clause
     * 6.2 expects namespace 1 or a vendor namespace; namespace 0 is reserved for
     * the OPC Foundation and is never right for an alias.
     *
     * Omit it and the binding falls back to the Server's own namespace. A store
     * that is not backed by the address space — one holding aliases published
     * elsewhere — should set it.
     */
    aliasNameNamespaceUri?: string;

    /**
     * The Nodes this alias names. Clause 7.2: there is always at least one.
     *
     * The order is the Server's recommendation, best first (clause 6.3.2).
     * Ordering *within* this array is the store's responsibility: an
     * {@link AliasComparator} orders entries relative to one another and never
     * reorders the targets inside one, and neither does merging by name.
     */
    referencedNodes: ExpandedNodeId[];

    /**
     * The ServerUri for each entry of {@link referencedNodes}, same length and
     * same order.
     *
     * `null` means the Node is on this Server (clause 7.3). Only
     * `FindAliasVerbose` exposes this; `FindAlias` drops it.
     */
    serverUris: (string | null)[];

    /** The `AliasNameCategoryType` instance that holds this alias. */
    categoryNodeId: NodeId;

    /**
     * The ReferenceType linking the AliasName Object to each entry of
     * {@link referencedNodes} — `AliasFor` (i=23469) or a subtype (clause 8.2).
     *
     * Parallel to `referencedNodes`, same length and same order: one alias may
     * reach different targets through different `AliasFor` subtypes, so a single
     * value could only ever describe the first.
     */
    referenceTypeIds: NodeId[];
}

/** The search a `FindAlias` / `FindAliasVerbose` call turns into. */
export interface AliasQuery {
    /**
     * The `AliasNameSearchPattern` argument: an OPC 10000-4 `Like` pattern.
     *
     * @see {@link like}
     */
    pattern: string;

    /**
     * The `ReferenceTypeFilter` argument: restricts the result to aliases whose
     * link to their target is of this ReferenceType **or a subtype of it**
     * (clause 6.3.2 Table 3).
     *
     * `undefined` or a null NodeId means any ReferenceType.
     */
    referenceTypeFilter?: NodeId;

    /**
     * The `AliasNameCategoryType` instance the Method was called on. The search
     * runs recursively from here (clause 6.3.1), so a call on `Aliases` also
     * covers `TagVariables`, `Topics` and anything nested below them.
     */
    categoryNodeId: NodeId;

    /**
     * Stop and report `Bad_ResponseTooLarge` beyond this many results
     * (clause 6.3.2 Table 4).
     */
    maxResults?: number;
}

/**
 * Where a server's own AliasNames live.
 *
 * @experimental The shape of this interface is expected to move before it is
 * considered stable. It is exported so a server can supply its own backing
 * store (a database, a configuration file, an existing tag dictionary) instead
 * of the address-space-backed default, but treat it as provisional: in
 * particular the optional mutation half may grow a transaction boundary once
 * the Configuration Support facet (clause 6.3.4 / 6.3.5) has been exercised
 * against a conformance tool.
 *
 * Aggregating aliases collected from *other* servers (Annex B, Annex C) is out
 * of scope for these packages; a store implementation is expected to describe
 * only this server's own aliases.
 */
export interface IAliasStore {
    /**
     * Every alias matching `query`, best match first (clause 6.3.2).
     *
     * Returns an empty array when nothing matches — that is a `Good` response
     * with an empty `AliasNodeList`, not an error.
     */
    find(query: AliasQuery): AliasEntry[] | Promise<AliasEntry[]>;

    /**
     * The `LastChange` of a category as a `VersionTime`, already rolled up from
     * its descendants (clause 6.3.1).
     */
    lastChange(categoryNodeId: NodeId): number | Promise<number>;

    /**
     * Add aliases to a category. Present only on a writable store.
     *
     * Returns one StatusCode **per entry, in the same order and of the same
     * length** — `AddAliasesToCategory` reports its outcome per item, not per
     * call (clause 6.3.4 Table 10). A store is expected to produce
     * `Bad_NodeIdInvalid` or `Bad_NodeIdUnknown` for a target it cannot resolve
     * locally, `Bad_NotSupported` if it does not accept remote targets at all,
     * and `Uncertain_ReferenceOutOfServer` for any target on another Server —
     * including the case where no check was performed, which is why the
     * uncertain code exists.
     *
     * An exact duplicate of (AliasName, target, target Server) is `Good` and
     * ignored, whether it was already stored or repeated within this call.
     */
    add?(categoryNodeId: NodeId, entries: AliasEntry[]): StatusCode[] | Promise<StatusCode[]>;

    /**
     * Remove aliases from a category. Present only on a writable store.
     *
     * Returns one StatusCode **per entry, in the same order and of the same
     * length** (clause 6.3.5 Table 14): `Bad_NotFound` when the alias is not
     * there, `Bad_InvalidState` when it is not owned by the local Server.
     *
     * Removal is all-or-nothing per name — if any target of a name cannot be
     * removed, none of that name's targets are — and removing the last target
     * removes the `AliasNameType` Object, since clause 7.2 gives it at least one
     * ReferencedNode.
     */
    delete?(
        categoryNodeId: NodeId,
        entries: Pick<AliasEntry, "aliasName" | "referencedNodes">[]
    ): StatusCode[] | Promise<StatusCode[]>;
}
