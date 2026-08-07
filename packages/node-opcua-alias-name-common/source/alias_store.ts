/**
 * @module node-opcua-alias-name-common
 *
 * The data model shared by the AliasName server and client packages
 * (OPC 10000-17).
 */

import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

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
     * The Nodes this alias names. Clause 7.2: there is always at least one.
     *
     * The order is significant — clause 6.3.2 requires the Server to return its
     * best match first.
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
     * The ReferenceType of the link from the AliasName Object to its target,
     * `AliasFor` (i=23469) or a subtype (clause 8.2).
     */
    referenceTypeId: NodeId;
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

    /** Add aliases to a category. Present only on a writable store. */
    add?(categoryNodeId: NodeId, entries: AliasEntry[]): void | Promise<void>;

    /** Remove aliases from a category. Present only on a writable store. */
    delete?(categoryNodeId: NodeId, entries: Pick<AliasEntry, "aliasName" | "referencedNodes">[]): void | Promise<void>;
}
