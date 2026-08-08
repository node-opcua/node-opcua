/**
 * @module node-opcua-alias-name-server
 *
 * An {@link IAliasStore} backed directly by the address space.
 *
 * This is the default store, and the reason `installAliasNames(server)` needs no
 * application code: a Server whose NodeSet2.xml already models `AliasNameType`
 * instances answers `FindAlias` correctly with nothing else configured. The
 * address space *is* the database.
 */

import type { IAddressSpace, UAObject } from "node-opcua-address-space-base";
import {
    type AliasEntry,
    type AliasQuery,
    type IAliasStore,
    type LikeOptions,
    LikePattern,
    maxVersionTime,
    nowVersionTime
} from "node-opcua-alias-name-common";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { ExpandedNodeId, type NodeId, NodeId as NodeIdClass, type NodeIdType } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { addAlias, findAlias, removeAlias } from "./add_alias.js";
import { aliasesOf, collectCategories } from "./alias_hierarchy.js";
import { ALIAS_FOR } from "./well_known.js";

/**
 * An ExpandedNodeId as a NodeId on this Server, dropping the ServerIndex.
 *
 * Clause 6.3.4 Table 9: *"The ServerIndex in the ExpandedNodeId shall be ignored
 * and the TargetServers Uri shall be used."*
 *
 * Built from the identifier's own parts rather than by re-parsing its string
 * form, which would have to cope with `svr=`, `nsu=` and quoting. When the
 * ExpandedNodeId carries a namespace URI, that URI decides the index — the
 * numeric index travelling beside it belongs to the *sending* Server's namespace
 * table, not ours.
 */
function toLocalNodeId(addressSpace: IAddressSpace, nodeId: ExpandedNodeId): NodeId | null {
    let namespaceIndex = nodeId.namespace ?? 0;
    if (nodeId.namespaceUri) {
        const resolved = addressSpace.getNamespaceIndex(nodeId.namespaceUri);
        if (resolved < 0) {
            // a namespace this Server does not know: the Node cannot be here
            return null;
        }
        namespaceIndex = resolved;
    }
    return new NodeIdClass(nodeId.identifierType, nodeId.value, namespaceIndex);
}

export interface AddressSpaceAliasStoreOptions {
    /** Passed through to the OPC 10000-4 `Like` matcher. */
    likeOptions?: LikeOptions;
    /**
     * Accept `AddAliasesToCategory` entries whose target is on another Server.
     *
     * Off by default. Clause 6.3.4 Table 10 makes `Bad_NotSupported` an
     * explicitly allowed answer — *"Support for remote Server TargetNodes is
     * optional"* — and storing a reference this Server can never resolve or
     * verify is a poor default. When on, such entries are accepted and reported
     * `Uncertain_ReferenceOutOfServer`, since this Server does not check Nodes
     * on other Servers.
     */
    allowRemoteTargets?: boolean;
}

/** Turn a local NodeId into an ExpandedNodeId with the namespace URI filled in. */
function toExpandedNodeId(addressSpace: IAddressSpace, nodeId: NodeId): ExpandedNodeId {
    const namespaceUri = nodeId.namespace === 0 ? null : addressSpace.getNamespaceUri(nodeId.namespace);
    return new ExpandedNodeId(
        nodeId.identifierType as unknown as NodeIdType,
        nodeId.value,
        nodeId.namespace,
        namespaceUri,
        // clause 7.3: the ServerIndex is carried separately in ServerUris, and
        // clause 6.3.4 Table 9 says an incoming ServerIndex is ignored anyway
        0
    );
}

export class AddressSpaceAliasStore implements IAliasStore {
    private readonly addressSpace: IAddressSpace;
    private readonly likeOptions?: LikeOptions;
    /** Per-category `LastChange`, as a VersionTime (clause 6.3.1). */
    private readonly lastChangeByCategory = new Map<string, number>();

    private readonly allowRemoteTargets: boolean;

    constructor(addressSpace: IAddressSpace, options?: AddressSpaceAliasStoreOptions) {
        this.addressSpace = addressSpace;
        this.likeOptions = options?.likeOptions;
        this.allowRemoteTargets = options?.allowRemoteTargets ?? false;
    }

    /**
     * Every alias at or below `query.categoryNodeId` matching the pattern.
     *
     * The search is recursive from the category the Method was called on
     * (clause 6.3.1), so a call on `Aliases` also covers `TagVariables`,
     * `Topics` and anything nested below them.
     *
     * One entry is produced per (AliasName, category) pair: `FindAliasVerbose`
     * has to name the category that actually held the alias, which for a nested
     * hit is the nested one, not the one that was called.
     */
    public async find(query: AliasQuery): Promise<AliasEntry[]> {
        const root = this.addressSpace.findNode(query.categoryNodeId);
        if (!root || root.nodeClass !== NodeClass.Object) {
            return [];
        }
        // an invalid pattern throws InvalidLikePatternError, which the Method
        // binding turns into Bad_InvalidArgument (clause 6.3.2 Table 4)
        const pattern = new LikePattern(query.pattern, this.likeOptions);

        const referenceTypeFilter = this.resolveReferenceTypeFilter(query.referenceTypeFilter);
        const entries: AliasEntry[] = [];

        // Stop one past the cap. The caller only needs to know that the cap was
        // exceeded, so collecting the whole hierarchy first would be wasted work
        // -- and on a Server with a large tag set, a `%` pattern would build the
        // entire result set purely to throw it away with Bad_ResponseTooLarge.
        const collectLimit = query.maxResults === undefined ? Number.POSITIVE_INFINITY : query.maxResults + 1;

        for (const category of collectCategories(this.addressSpace, root as UAObject)) {
            if (entries.length >= collectLimit) {
                break;
            }
            // Skipped before its aliases are walked, so the cap is spent only on
            // entries the caller may see - and the scan does less work. Only
            // this category is skipped, not its descendants: the gate is
            // per-category, and a denied parent does not imply a denied child.
            if (query.isVisible && !(await query.isVisible(category.nodeId))) {
                continue;
            }
            for (const alias of aliasesOf(this.addressSpace, category)) {
                if (entries.length >= collectLimit) {
                    break;
                }
                const aliasName = alias.browseName.name;
                if (!aliasName || !pattern.test(aliasName)) {
                    continue;
                }
                const targets = this.targetsOf(alias, referenceTypeFilter);
                if (targets.length === 0) {
                    // clause 6.3.2 Table 3: an alias with no Reference of the
                    // requested type is simply not a match
                    continue;
                }
                entries.push({
                    aliasName,
                    // the namespace the alias Object was actually published in,
                    // not the category's - Aliases and friends live in
                    // namespace 0, which clause 6.2 never intends for an alias
                    aliasNameNamespaceUri: this.namespaceUriOf(alias.browseName.namespaceIndex),
                    referencedNodes: targets.map((t) => t.expandedNodeId),
                    // every target is on this Server; aggregating other Servers
                    // is out of scope for this package (Annex B / Annex C)
                    serverUris: targets.map(() => null),
                    categoryNodeId: category.nodeId,
                    referenceTypeIds: targets.map((t) => t.referenceTypeId)
                });
            }
        }
        return entries;
    }

    /** `LastChange` for a category, rolled up from its descendants (clause 6.3.1). */
    public lastChange(categoryNodeId: NodeId): number {
        const root = this.addressSpace.findNode(categoryNodeId);
        if (!root || root.nodeClass !== NodeClass.Object) {
            return this.lastChangeByCategory.get(categoryNodeId.toString()) ?? 0;
        }
        let latest = 0;
        for (const category of collectCategories(this.addressSpace, root as UAObject)) {
            latest = maxVersionTime(latest, this.lastChangeByCategory.get(category.nodeId.toString()) ?? 0);
        }
        return latest;
    }

    /**
     * Record that a category changed, at `versionTime` (defaulting to now).
     *
     * Only the category itself is stored; the rollup to ancestors happens on
     * read, so a category that is later re-parented reports correctly without
     * anything having to be recomputed.
     */
    public touch(categoryNodeId: NodeId, versionTime?: number): number {
        const value = versionTime ?? nowVersionTime();
        const key = categoryNodeId.toString();
        this.lastChangeByCategory.set(key, maxVersionTime(this.lastChangeByCategory.get(key) ?? 0, value));
        return value;
    }

    /** Restore persisted `LastChange` values (clause 6.3.1: "shall be persisted"). */
    public restoreLastChange(values: Iterable<readonly [string, number]>): void {
        for (const [key, value] of values) {
            this.lastChangeByCategory.set(key, value);
        }
    }

    /** Snapshot the per-category `LastChange` values for persistence. */
    public snapshotLastChange(): Array<[string, number]> {
        return [...this.lastChangeByCategory.entries()];
    }

    /**
     * Add aliases to a category (clause 6.3.4), one StatusCode per entry.
     *
     * The per-item codes of Table 10:
     *
     * - `Bad_NodeIdInvalid` — the NodeId is syntactically unusable.
     * - `Bad_NodeIdUnknown` — the target is on this Server and does not exist.
     * - `Uncertain_ReferenceOutOfServer` — the target is on another Server. The
     *   clause is explicit that this is returned **whether or not** a check was
     *   performed: *"If the Server does not check for the external Node's
     *   existence, it shall return Uncertain_ReferenceOutOfServer."* This Server
     *   does not check, because checking means being a Client of the other
     *   Server, which is the aggregation these packages exclude by design.
     * - `Bad_NotSupported` — when {@link AddressSpaceAliasStoreOptions.allowRemoteTargets}
     *   is off, which Table 10 explicitly permits.
     *
     * An exact duplicate of (AliasName, target, target Server) is `Good` and
     * ignored, whether it was already stored or repeated within this call.
     */
    public add(categoryNodeId: NodeId, entries: AliasEntry[]): StatusCode[] {
        const category = this.addressSpace.findNode(categoryNodeId);
        if (!category || category.nodeClass !== NodeClass.Object) {
            return entries.map(() => StatusCodes.BadNodeIdUnknown);
        }
        const categoryNode = category as UAObject;

        // duplicates repeated *within* this call are ignored too, so the set
        // has to grow as we go rather than being a snapshot of the start state
        const seenInThisCall = new Set<string>();

        return entries.map((entry) => {
            const target = entry.referencedNodes[0];
            const serverUri = entry.serverUris[0] ?? null;

            if (!target) {
                return StatusCodes.BadNodeIdInvalid;
            }
            if (!entry.aliasName) {
                return StatusCodes.BadNodeIdInvalid;
            }

            const key = `${entry.aliasName} ${target.toString()} ${serverUri ?? ""}`;
            if (seenInThisCall.has(key)) {
                return StatusCodes.Good;
            }
            seenInThisCall.add(key);

            // Table 9: the ServerIndex inside the ExpandedNodeId is ignored;
            // TargetServers is authoritative
            if (serverUri !== null) {
                if (!this.allowRemoteTargets) {
                    return StatusCodes.BadNotSupported;
                }
                return this.addRemote(categoryNode, entry, target, serverUri);
            }

            return this.addLocal(categoryNode, entry, target);
        });
    }

    /**
     * Remove aliases from a category (clause 6.3.5), one StatusCode per entry.
     *
     * `Bad_NotFound` when the name is not in the category, `Bad_InvalidState`
     * when it is there but not owned by this Server — clause 6.3.5 opens by
     * saying a Server "shall only delete AliasName instances that are defined on
     * the Server exposing this Method".
     *
     * An entry with no target removes every target of that name. Removal is
     * all-or-nothing per name: if any target cannot go, none of that name's do.
     */
    public delete(categoryNodeId: NodeId, entries: Pick<AliasEntry, "aliasName" | "referencedNodes">[]): StatusCode[] {
        const category = this.addressSpace.findNode(categoryNodeId);
        if (!category || category.nodeClass !== NodeClass.Object) {
            return entries.map(() => StatusCodes.BadNotFound);
        }
        const categoryNode = category as UAObject;

        return entries.map((entry) => {
            const alias = findAlias(this.addressSpace, categoryNode, entry.aliasName);
            if (!alias) {
                return StatusCodes.BadNotFound;
            }
            // an alias whose targets all live on other Servers was learned from
            // elsewhere and is not ours to delete
            if (this.isForeign(alias)) {
                return StatusCodes.BadInvalidState;
            }

            const requested = entry.referencedNodes ?? [];
            if (requested.length === 0) {
                // "all AliasNames with the provided name are deleted"
                removeAlias(this.addressSpace, categoryNode, entry.aliasName);
                return StatusCodes.Good;
            }

            // all or nothing: check every requested target is present first
            const references = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward);
            const present = new Set(references.map((r) => r.nodeId.toString()));
            const wanted: NodeId[] = [];
            for (const target of requested) {
                const local = toLocalNodeId(this.addressSpace, target);
                if (!local || !present.has(local.toString())) {
                    return StatusCodes.BadNotFound;
                }
                wanted.push(local);
            }
            for (const target of wanted) {
                removeAlias(this.addressSpace, categoryNode, entry.aliasName, target);
            }
            return StatusCodes.Good;
        });
    }

    /** Add an alias whose target is on this Server. */
    private addLocal(category: UAObject, entry: AliasEntry, target: ExpandedNodeId): StatusCode {
        const localNodeId = toLocalNodeId(this.addressSpace, target);
        if (!localNodeId) {
            return StatusCodes.BadNodeIdInvalid;
        }
        if (!this.addressSpace.findNode(localNodeId)) {
            // Table 10: "The TargetNode does not exist in the AliasName Server
            // and the TargetServer is the local server"
            return StatusCodes.BadNodeIdUnknown;
        }
        try {
            addAlias(this.addressSpace, category, entry.aliasName, localNodeId, {
                referenceType: entry.referenceTypeIds[0]
            });
        } catch {
            // a category restriction (clause 9.3 / 9.4) refused the target
            return StatusCodes.BadNodeIdInvalid;
        }
        return StatusCodes.Good;
    }

    /**
     * Add an alias whose target is on another Server.
     *
     * Always `Uncertain_ReferenceOutOfServer`: this Server does not verify
     * Nodes on other Servers, and clause 6.3.4 says that case returns the
     * uncertain code rather than success.
     */
    private addRemote(category: UAObject, entry: AliasEntry, target: ExpandedNodeId, _serverUri: string): StatusCode {
        try {
            addAlias(this.addressSpace, category, entry.aliasName, target, {
                referenceType: entry.referenceTypeIds[0],
                allowUnresolvedTarget: true
            });
        } catch {
            return StatusCodes.BadNodeIdInvalid;
        }
        return StatusCodes.UncertainReferenceOutOfServer;
    }

    /** True when none of the alias's targets are on this Server. */
    private isForeign(alias: UAObject): boolean {
        const references = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward);
        if (references.length === 0) {
            return false;
        }
        return references.every((reference) => this.addressSpace.findNode(reference.nodeId) === null);
    }

    /** The URI of a namespace index, or undefined for namespace 0. */
    private namespaceUriOf(namespaceIndex: number): string | undefined {
        // namespace 0 is the OPC Foundation's and is never a legitimate alias
        // namespace; reporting it would be worse than reporting nothing
        return namespaceIndex === 0 ? undefined : this.addressSpace.getNamespaceUri(namespaceIndex);
    }

    /**
     * Resolve the `ReferenceTypeFilter` argument.
     *
     * A null or absent NodeId means any ReferenceType (clause 6.3.2 Table 3).
     */
    private resolveReferenceTypeFilter(filter: NodeId | undefined): NodeId | null {
        if (!filter || filter.isEmpty()) {
            return null;
        }
        return filter;
    }

    /**
     * The Nodes an alias points at.
     *
     * `findReferencesEx` already includes subtypes of the ReferenceType, which
     * is what clause 6.3.2 Table 3 asks for: "Any ReferenceType includes all
     * subtypes of that ReferenceType".
     *
     * An absent filter falls back to `AliasFor` rather than to *every*
     * ReferenceType. Table 3 describes the filter as "AliasFor or one of its
     * subtypes", and clause 8.2 makes `AliasFor` the ReferenceType that links an
     * AliasName to what it names; taking "any" literally would return the
     * alias's `HasTypeDefinition` target and its Organizes back-reference, which
     * are not things the alias names.
     */
    private targetsOf(
        alias: UAObject,
        referenceTypeFilter: NodeId | null
    ): Array<{ expandedNodeId: ExpandedNodeId; referenceTypeId: NodeId }> {
        const referenceType = referenceTypeFilter ?? ALIAS_FOR;
        const references = alias.findReferencesEx(referenceType, BrowseDirection.Forward);
        return references.map((reference) => ({
            expandedNodeId: toExpandedNodeId(this.addressSpace, reference.nodeId),
            referenceTypeId: reference.referenceType
        }));
    }
}
