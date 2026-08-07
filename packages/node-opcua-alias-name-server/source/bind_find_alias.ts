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
     */
    isReadAllowed?: (context: ISessionContext) => boolean;
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
    for (const entry of entries) {
        const existing = byName.get(entry.aliasName);
        if (!existing) {
            byName.set(entry.aliasName, { ...entry, referencedNodes: [...entry.referencedNodes] });
            continue;
        }
        for (const node of entry.referencedNodes) {
            const already = existing.referencedNodes.some((n) => n.toString() === node.toString());
            if (!already) {
                existing.referencedNodes.push(node);
            }
        }
    }
    return [...byName.values()];
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
        if (options.isReadAllowed && !options.isReadAllowed(context)) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }

        const pattern = readPattern(inputArguments);
        if (pattern === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        const category = this.parent as UAObject | null;
        if (!category) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        const query: AliasQuery = {
            pattern,
            referenceTypeFilter: readReferenceTypeFilter(inputArguments),
            categoryNodeId: category.nodeId,
            maxResults: options.maxResults
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

        const results = verbose ? found : mergeByAliasName(found);

        // clause 6.3.2 Table 4: too large to return, "try new filter and repeat find"
        if (results.length > options.maxResults) {
            return { statusCode: StatusCodes.BadResponseTooLarge };
        }

        // sort() is stable in modern JavaScript, so a comparator that returns 0
        // leaves discovery order untouched
        const ordered = [...results].sort(comparator);

        // No match is Good with an empty AliasNodeList (clause 6.3.2 Table 3),
        // never an error.
        const value = verbose
            ? ordered.map(
                  (entry) =>
                      new AliasNameVerboseDataType({
                          aliasName: { name: entry.aliasName, namespaceIndex: category.browseName.namespaceIndex },
                          referencedNodes: entry.referencedNodes,
                          serverUris: entry.serverUris,
                          aliasNameCategoryId: entry.categoryNodeId
                      })
              )
            : ordered.map(
                  (entry) =>
                      new AliasNameDataType({
                          aliasName: { name: entry.aliasName, namespaceIndex: category.browseName.namespaceIndex },
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
