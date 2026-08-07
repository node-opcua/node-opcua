/**
 * @module node-opcua-alias-name-server
 *
 * The `FindAlias` (clause 6.3.2) and `FindAliasVerbose` (clause 6.3.3) Method
 * handlers.
 *
 * The two Methods are identical in every respect except the DataType they
 * return, so both are produced from one implementation: whatever the FindAlias
 * suite proves is proved for FindAliasVerbose too.
 */

import type { ISessionContext, UAMethod, UAObject } from "node-opcua-address-space-base";
import { type AliasEntry, type AliasQuery, type IAliasStore, InvalidLikePatternError } from "node-opcua-alias-name-common";
import { type NodeId, NodeId as NodeIdClass } from "node-opcua-nodeid";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { AliasNameDataType, AliasNameVerboseDataType } from "node-opcua-types";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";

/**
 * Orders results before they are returned.
 *
 * Clause 6.3.2 requires the Server to return "what it recommends as the best
 * match first", and says the criteria are Server specific — the examples it
 * gives (ServerStatus of the Server holding the Node, load balancing) only mean
 * anything once more than one Server is involved. A Server publishing its own
 * aliases has no basis to prefer one of its own Nodes over another, so the
 * default preserves discovery order, which is at least deterministic and
 * therefore stable across calls. Replace it when the Server does have a basis.
 */
export type AliasComparator = (a: AliasEntry, b: AliasEntry) => number;

/** The default: keep discovery order (a stable no-op comparator). */
export const insertionOrderComparator: AliasComparator = () => 0;

export interface FindAliasBindingOptions {
    /** Where the aliases come from. */
    store: IAliasStore;
    /**
     * Beyond this many results the call fails with `Bad_ResponseTooLarge`
     * (clause 6.3.2 Table 4).
     */
    maxResults: number;
    /** Result ordering; defaults to {@link insertionOrderComparator}. */
    comparator?: AliasComparator;
    /**
     * Read gate. Return false to answer `Bad_UserAccessDenied`
     * (clause 6.3.2 Table 4). Defaults to allowing everyone, matching a Server
     * that publishes its aliases openly.
     *
     * Receives the category the Method was called on, so a Server with
     * per-customer or per-tenant categories can answer "may this user see *this*
     * category" rather than only "may this user read aliases at all". May return
     * a Promise: the handler is async anyway, so a permission lookup that hits a
     * database costs nothing structurally.
     */
    isReadAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
}

/** Read `AliasNameSearchPattern` (argument 0). */
function readPattern(inputArguments: Variant[]): string | null {
    const value = inputArguments?.[0]?.value;
    if (value === null || value === undefined) {
        // clause 6.3.2 gives no meaning to a null pattern; treat it as "match
        // everything" would silently dump the whole hierarchy, so reject it
        return null;
    }
    return typeof value === "string" ? value : null;
}

/** Read `ReferenceTypeFilter` (argument 1). */
function readReferenceTypeFilter(inputArguments: Variant[]): NodeId | undefined {
    const value = inputArguments?.[1]?.value;
    return value instanceof NodeIdClass ? value : undefined;
}

/**
 * Merge entries that share an AliasName.
 *
 * `AliasNameDataType` is "an array of ExpandedNodeId for a single AliasName"
 * (clause 7.2), so the non-verbose Method reports one entry per distinct name
 * with all of its targets. The verbose form does *not* merge: its
 * `AliasNameCategoryId` names the category that held the alias, which differs
 * between entries.
 */
function mergeByAliasName(entries: AliasEntry[]): AliasEntry[] {
    const byName = new Map<string, AliasEntry>();
    // Membership is kept in a Set per name rather than rescanning the growing
    // array: with a linear scan, a name shared by many entries makes this
    // quadratic in the size of the result set.
    const seenTargets = new Map<string, Set<string>>();

    for (const entry of entries) {
        const existing = byName.get(entry.aliasName);
        if (!existing) {
            byName.set(entry.aliasName, { ...entry, referencedNodes: [...entry.referencedNodes] });
            seenTargets.set(entry.aliasName, new Set(entry.referencedNodes.map((n) => n.toString())));
            continue;
        }
        const seen = seenTargets.get(entry.aliasName)!;
        for (const node of entry.referencedNodes) {
            const key = node.toString();
            if (!seen.has(key)) {
                seen.add(key);
                existing.referencedNodes.push(node);
            }
        }
    }
    return [...byName.values()];
}

/**
 * Resolve each entry's AliasName namespace index, once per call.
 *
 * The namespace reported is the one the alias was published in, taken from the
 * store. Using the *category's* namespace instead would put every alias on the
 * three well-known categories into namespace 0, which is reserved for the OPC
 * Foundation and is not what clause 6.2 intends. A store that does not know its
 * namespace falls back to the Server's own, never to 0.
 *
 * Clients ignore the namespace when comparing AliasNames (clause 6.2), so this
 * is not a matching concern — it is a matter of reporting truthfully.
 */
function makeNamespaceResolver(category: UAObject): (entry: AliasEntry) => number {
    const addressSpace = category.addressSpace;
    const ownNamespaceIndex = addressSpace.getOwnNamespace().index;
    const cache = new Map<string, number>();

    return (entry: AliasEntry): number => {
        if (!entry.aliasNameNamespaceUri) {
            return ownNamespaceIndex;
        }
        const cached = cache.get(entry.aliasNameNamespaceUri);
        if (cached !== undefined) {
            return cached;
        }
        const index = addressSpace.getNamespaceIndex(entry.aliasNameNamespaceUri);
        // an unregistered URI resolves to -1; reporting the Server's own
        // namespace is closer to the truth than reporting namespace 0
        const resolved = index >= 0 ? index : ownNamespaceIndex;
        cache.set(entry.aliasNameNamespaceUri, resolved);
        return resolved;
    };
}

/**
 * Build a handler for `FindAlias` or `FindAliasVerbose`.
 *
 * `this` is the Method node, so the category searched is the Method's parent —
 * that is what makes one handler serve every instance of
 * `AliasNameCategoryType`, including vendor subcategories created through the
 * `<SubAliasNameCategories>` placeholder.
 */
export function makeFindAliasHandler(options: FindAliasBindingOptions, verbose: boolean) {
    const comparator = options.comparator ?? insertionOrderComparator;

    return async function findAliasHandler(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const category = this.parent as UAObject | null;
        if (!category) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // The gate is consulted per category, and each category at most once per
        // call. Memoised because a recursive search reaches the same category
        // through every alias it holds, and the rule may hit a database.
        const gate = options.isReadAllowed;
        const decisions = new Map<string, boolean>();
        const mayRead = async (categoryNodeId: NodeId): Promise<boolean> => {
            if (!gate) {
                return true;
            }
            const key = categoryNodeId.toString();
            const cached = decisions.get(key);
            if (cached !== undefined) {
                return cached;
            }
            const allowed = await gate(context, categoryNodeId);
            decisions.set(key, allowed);
            return allowed;
        };

        // A direct call on a category the caller may not read is
        // Bad_UserAccessDenied: there is nothing left to filter, so silence
        // would be a lie rather than a non-disclosure.
        if (!(await mayRead(category.nodeId))) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }

        const pattern = readPattern(inputArguments);
        if (pattern === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        const query: AliasQuery = {
            pattern,
            referenceTypeFilter: readReferenceTypeFilter(inputArguments),
            categoryNodeId: category.nodeId,
            maxResults: options.maxResults,
            // Handed the same memoised closure the filter below uses, so the
            // rule is evaluated at most once per category per call however many
            // times it is consulted. Passed only when a gate is configured, so
            // an ungated Server takes exactly the path it took before.
            isVisible: gate ? mayRead : undefined
        };

        let found: AliasEntry[];
        try {
            found = await options.store.find(query);
        } catch (err) {
            if (err instanceof InvalidLikePatternError) {
                // clause 6.3.2 Table 4: "The input string is not a valid search string"
                return { statusCode: StatusCodes.BadInvalidArgument };
            }
            throw err;
        }

        // clause 6.3.2 Table 4: too large to return, "try new filter and repeat find".
        //
        // Applied to what the store produced, *before* filtering and merging.
        // The store stops collecting one entry past the cap, so a count that
        // reaches it means "there may be more"; reducing the count first would
        // report a truncated scan as a complete answer. The code names no
        // category, so it discloses nothing a gated caller should not see.
        if (found.length > options.maxResults) {
            return { statusCode: StatusCodes.BadResponseTooLarge };
        }

        // A nested category the caller may not read is omitted, and the call
        // still succeeds: an error, or a count that changed, would confirm the
        // category exists. Absence is the only answer that discloses nothing.
        //
        // The store was given the same predicate and should already have skipped
        // these, so this is normally a no-op. It stays as a backstop: an injected
        // store written by someone else may ignore `isVisible`, and the cost of
        // that must be a wasted scan, never a leak.
        const visible: AliasEntry[] = [];
        for (const entry of found) {
            if (await mayRead(entry.categoryNodeId)) {
                visible.push(entry);
            }
        }

        // Filtering happens before the verbose/plain split, so FindAliasVerbose
        // cannot reveal a ServerUri or an AliasNameCategoryId for a category
        // that FindAlias would have hidden.
        const results = verbose ? visible : mergeByAliasName(visible);

        // sort() is stable in modern JavaScript, so a comparator that returns 0
        // leaves discovery order untouched
        const ordered = [...results].sort(comparator);

        // No match is Good with an empty AliasNodeList (clause 6.3.2 Table 3),
        // never an error.
        const namespaceIndexOf = makeNamespaceResolver(category);
        const value = verbose
            ? ordered.map(
                  (entry) =>
                      new AliasNameVerboseDataType({
                          aliasName: { name: entry.aliasName, namespaceIndex: namespaceIndexOf(entry) },
                          referencedNodes: entry.referencedNodes,
                          serverUris: entry.serverUris,
                          aliasNameCategoryId: entry.categoryNodeId
                      })
              )
            : ordered.map(
                  (entry) =>
                      new AliasNameDataType({
                          aliasName: { name: entry.aliasName, namespaceIndex: namespaceIndexOf(entry) },
                          referencedNodes: entry.referencedNodes
                      })
              );

        return {
            statusCode: StatusCodes.Good,
            outputArguments: [
                {
                    dataType: DataType.ExtensionObject,
                    arrayType: VariantArrayType.Array,
                    value
                }
            ]
        };
    };
}
