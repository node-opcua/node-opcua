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
    LikePattern,
    type LikeOptions,
    maxVersionTime,
    nowVersionTime
} from "node-opcua-alias-name-common";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { ExpandedNodeId, type NodeId, NodeIdType } from "node-opcua-nodeid";
import { aliasesOf, collectCategories } from "./alias_hierarchy.js";
import { ALIAS_FOR } from "./well_known.js";

export interface AddressSpaceAliasStoreOptions {
    /** Passed through to the OPC 10000-4 `Like` matcher. */
    likeOptions?: LikeOptions;
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

    constructor(addressSpace: IAddressSpace, options?: AddressSpaceAliasStoreOptions) {
        this.addressSpace = addressSpace;
        this.likeOptions = options?.likeOptions;
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
    public find(query: AliasQuery): AliasEntry[] {
        const root = this.addressSpace.findNode(query.categoryNodeId);
        if (!root || root.nodeClass !== NodeClass.Object) {
            return [];
        }
        // an invalid pattern throws InvalidLikePatternError, which the Method
        // binding turns into Bad_InvalidArgument (clause 6.3.2 Table 4)
        const pattern = new LikePattern(query.pattern, this.likeOptions);

        const referenceTypeFilter = this.resolveReferenceTypeFilter(query.referenceTypeFilter);
        const entries: AliasEntry[] = [];

        for (const category of collectCategories(this.addressSpace, root as UAObject)) {
            for (const alias of aliasesOf(this.addressSpace, category)) {
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
                    referencedNodes: targets.map((t) => t.expandedNodeId),
                    // every target is on this Server; aggregating other Servers
                    // is out of scope for this package (Annex B / Annex C)
                    serverUris: targets.map(() => null),
                    categoryNodeId: category.nodeId,
                    referenceTypeId: targets[0].referenceTypeId
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
