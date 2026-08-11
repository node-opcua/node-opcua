/**
 * @module node-opcua-alias-name-client
 *
 * Recover the ReferenceType linking each AliasName to each of its targets.
 *
 * `AliasNameDataType` and `AliasNameVerboseDataType` (OPC 10000-17 clauses 7.2
 * and 7.3) carry the referenced Nodes, but **not** the ReferenceType of each
 * Reference: a target linked with a vendor subtype of `AliasFor` (clause 8.2)
 * comes back from `FindAlias` / `FindAliasVerbose` indistinguishable from one
 * linked with `AliasFor` itself. That is a limitation of the DataTypes, not of
 * any particular Server.
 *
 * Most Clients never notice — they want the NodeId and the subtype carries no
 * extra meaning for them. An **aggregating** Server does: re-published as plain
 * `AliasFor`, a downstream `FindAlias` whose `ReferenceTypeFilter` names the
 * subtype (clause 6.3.2 Table 3) cannot be answered faithfully across the
 * aggregation hop. {@link readAliasReferenceTypes} closes that gap by going
 * back to the address space: the `AliasNameType` instances are Nodes, and
 * Browse reports the ReferenceType of every Reference they hold.
 */

import { ReferenceTypeIds } from "node-opcua-constants";
import { BrowseDirection, makeResultMask } from "node-opcua-data-model";
import { type ExpandedNodeId, type NodeId, NodeId as NodeIdClass, resolveNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { BrowsePath } from "node-opcua-service-translate-browse-path";
import type { ReferenceDescription } from "node-opcua-types";
import type { ClientAliasVerboseEntry } from "./client_alias_set.js";

/** `AliasFor` (i=23469), the base ReferenceType of every alias link (clause 8.2). */
const ALIAS_FOR: NodeId = resolveNodeId(ReferenceTypeIds.AliasFor);
const HIERARCHICAL_REFERENCES: NodeId = resolveNodeId(ReferenceTypeIds.HierarchicalReferences);
const REFERENCE_TYPE_RESULT_MASK = makeResultMask("ReferenceType");
const DEFAULT_MAX_NODES_PER_CALL = 1000;

/** One (alias, target) link, with the ReferenceType the find Methods cannot report. */
export interface AliasReferenceTypeEntry {
    /** The Node the alias names — matches one element of `referencedNodes`. */
    targetNodeId: ExpandedNodeId;
    /** `AliasFor` (i=23469) or the subtype the publisher actually used. */
    referenceTypeId: NodeId;
}

export interface ReadAliasReferenceTypesOptions {
    /**
     * Upper bound on the operations packed into one `TranslateBrowsePaths` or
     * `Browse` request. The default of 1000 fits most Servers; lower it when a
     * Server advertises tighter `OperationLimits` (OPC 10000-5 clause 6.3.11) —
     * `Bad_TooManyOperations` is the symptom of exceeding them.
     */
    maxNodesPerCall?: number;
}

/**
 * Read the ReferenceType of every `AliasFor` Reference (and subtype) each alias
 * holds, which is the one thing `FindAliasVerbose` cannot report.
 *
 * ```ts
 * const entries = await aliases.findAliasVerbose("%", { categoryNodeId });
 * const referenceTypes = await readAliasReferenceTypes(session, entries);
 * for (const entry of entries) {
 *     for (const { targetNodeId, referenceTypeId } of referenceTypes.get(entry) ?? []) {
 *         republish(entry.aliasName, targetNodeId, referenceTypeId);
 *     }
 * }
 * ```
 *
 * **When to use it.** Only when the ReferenceType itself matters — typically an
 * aggregator that must re-publish pulled aliases with reference-type fidelity,
 * so a downstream `ReferenceTypeFilter` naming an `AliasFor` subtype keeps
 * working across the hop. A Client that only resolves names to NodeIds gets
 * nothing from it and should not pay for it.
 *
 * **What it costs.** On top of the find call already made: one
 * `TranslateBrowsePaths` request per {@link ReadAliasReferenceTypesOptions.maxNodesPerCall}
 * aliases to locate the `AliasNameType` instance Nodes (skipped when NodeIds
 * are passed directly), then one `Browse` request per batch, plus one
 * `BrowseNext` round trip per continuation the Server imposes. The requests are
 * batched precisely so a large category does **not** become one round trip per
 * alias: 1000 aliases resolve in two or three round trips, not 1000.
 *
 * The result is keyed by the **very elements passed in** — look entries up with
 * the objects from the input array, not with reconstructed equals. An input the
 * Server could not resolve (the alias was deleted since the find, a NodeId that
 * no longer browses) is absent from the map rather than present with a guess.
 *
 * @param session any `IBasicSessionAsync2` — a remote `ClientSession` or an
 *   in-process `PseudoSession`, as everywhere in this package
 * @param aliases either the entries of a `findAliasVerbose` call, or the
 *   NodeIds of `AliasNameType` instance Nodes when the caller already knows
 *   them (from browsing a category, or from its own bookkeeping)
 */
export async function readAliasReferenceTypes(
    session: IBasicSessionAsync2,
    aliases: NodeId[],
    options?: ReadAliasReferenceTypesOptions
): Promise<Map<NodeId, AliasReferenceTypeEntry[]>>;
export async function readAliasReferenceTypes(
    session: IBasicSessionAsync2,
    aliases: ClientAliasVerboseEntry[],
    options?: ReadAliasReferenceTypesOptions
): Promise<Map<ClientAliasVerboseEntry, AliasReferenceTypeEntry[]>>;
export async function readAliasReferenceTypes(
    session: IBasicSessionAsync2,
    aliases: NodeId[] | ClientAliasVerboseEntry[],
    options?: ReadAliasReferenceTypesOptions
): Promise<Map<NodeId | ClientAliasVerboseEntry, AliasReferenceTypeEntry[]>> {
    const maxNodesPerCall = Math.max(1, options?.maxNodesPerCall ?? DEFAULT_MAX_NODES_PER_CALL);
    const result = new Map<NodeId | ClientAliasVerboseEntry, AliasReferenceTypeEntry[]>();
    if (aliases.length === 0) {
        return result;
    }

    const aliasNodeIds: (NodeId | null)[] =
        aliases[0] instanceof NodeIdClass
            ? (aliases as NodeId[])
            : await resolveAliasNodeIds(session, aliases as ClientAliasVerboseEntry[], maxNodesPerCall);

    const targets = await browseAliasTargets(session, aliasNodeIds, maxNodesPerCall);
    aliases.forEach((key: NodeId | ClientAliasVerboseEntry, index: number) => {
        const entries = targets[index];
        if (entries) {
            result.set(key, entries);
        }
    });
    return result;
}

/**
 * Locate the `AliasNameType` instance Node behind each verbose entry.
 *
 * `FindAliasVerbose` names the category that held the alias
 * (`aliasNameCategoryId`, clause 7.3) but not the alias Node itself, so the
 * Node is found by translating one browse path below the category. The
 * `RelativePath` is built element by element rather than parsed from a string,
 * so an alias name containing `/`, `&` or the other OPC 10000-4 Annex A
 * reserved characters needs no escaping. The QualifiedName match is exact —
 * the entry's `namespaceIndex` is the one the Server reported, so this is the
 * one place the namespace of an AliasName is **not** ignored.
 *
 * Unresolvable entries yield `null`, keeping positions aligned with the input.
 */
async function resolveAliasNodeIds(
    session: IBasicSessionAsync2,
    entries: ClientAliasVerboseEntry[],
    maxNodesPerCall: number
): Promise<(NodeId | null)[]> {
    const aliasNodeIds: (NodeId | null)[] = new Array(entries.length).fill(null);
    for (let offset = 0; offset < entries.length; offset += maxNodesPerCall) {
        const chunk = entries.slice(offset, offset + maxNodesPerCall);
        const results = await session.translateBrowsePath(
            chunk.map(
                (entry) =>
                    new BrowsePath({
                        startingNode: entry.aliasNameCategoryId,
                        relativePath: {
                            elements: [
                                {
                                    referenceTypeId: HIERARCHICAL_REFERENCES,
                                    isInverse: false,
                                    includeSubtypes: true,
                                    targetName: { namespaceIndex: entry.namespaceIndex, name: entry.aliasName }
                                }
                            ]
                        }
                    })
            )
        );
        results.forEach((browsePathResult, index) => {
            if (browsePathResult.statusCode.isGood() && browsePathResult.targets?.length) {
                // the targetId of a local Node is an ExpandedNodeId with
                // serverIndex 0, usable as a NodeId as-is
                aliasNodeIds[offset + index] = browsePathResult.targets[0].targetId;
            }
        });
    }
    return aliasNodeIds;
}

/**
 * Browse the forward `AliasFor` References (subtypes included) of many alias
 * Nodes in as few requests as possible, following every continuation point.
 *
 * Positions align with the input; `null` marks a Node that could not be
 * resolved upstream or whose Browse did not complete — for the fidelity use
 * case, an absent answer beats a truncated one presented as complete.
 */
async function browseAliasTargets(
    session: IBasicSessionAsync2,
    aliasNodeIds: (NodeId | null)[],
    maxNodesPerCall: number
): Promise<(AliasReferenceTypeEntry[] | null)[]> {
    const targets: (AliasReferenceTypeEntry[] | null)[] = new Array(aliasNodeIds.length).fill(null);

    const toBrowse: { index: number; nodeId: NodeId }[] = [];
    aliasNodeIds.forEach((nodeId, index) => {
        if (nodeId) {
            toBrowse.push({ index, nodeId });
        }
    });

    const toEntry = (reference: ReferenceDescription): AliasReferenceTypeEntry => ({
        targetNodeId: reference.nodeId,
        referenceTypeId: reference.referenceTypeId
    });

    for (let offset = 0; offset < toBrowse.length; offset += maxNodesPerCall) {
        const chunk = toBrowse.slice(offset, offset + maxNodesPerCall);
        const browseResults = await session.browse(
            chunk.map(({ nodeId }) => ({
                nodeId,
                browseDirection: BrowseDirection.Forward,
                referenceTypeId: ALIAS_FOR,
                includeSubtypes: true,
                nodeClassMask: 0,
                resultMask: REFERENCE_TYPE_RESULT_MASK
            }))
        );

        // continuations, batched too: one BrowseNext round trip serves every
        // Node of the chunk that was truncated, however many there are
        let pending: { index: number; continuationPoint: Buffer }[] = [];
        browseResults.forEach((browseResult, chunkIndex) => {
            const { index } = chunk[chunkIndex];
            if (!browseResult.statusCode.isGood()) {
                return;
            }
            targets[index] = (browseResult.references ?? []).map(toEntry);
            if (browseResult.continuationPoint?.length) {
                pending.push({ index, continuationPoint: browseResult.continuationPoint });
            }
        });

        while (pending.length > 0) {
            const nextResults = await session.browseNext(
                pending.map(({ continuationPoint }) => continuationPoint),
                false
            );
            const stillPending: typeof pending = [];
            nextResults.forEach((browseResult, pendingIndex) => {
                const { index } = pending[pendingIndex];
                if (!browseResult.statusCode.isGood()) {
                    // incomplete: withdraw the partial answer rather than let it
                    // pass for the whole truth
                    targets[index] = null;
                    return;
                }
                targets[index]?.push(...(browseResult.references ?? []).map(toEntry));
                if (browseResult.continuationPoint?.length) {
                    stillPending.push({ index, continuationPoint: browseResult.continuationPoint });
                }
            });
            pending = stillPending;
        }
    }
    return targets;
}
