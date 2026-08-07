/**
 * @module node-opcua-alias-name-client
 *
 * Client-side API for OPC UA AliasNames (OPC 10000-17).
 *
 * All navigation goes through {@link IBasicSessionAsync2} — browse, read, call,
 * translateBrowsePath — so the same code drives a remote `ClientSession` and an
 * in-process `PseudoSession`. That is what lets these be tested without a
 * transport, and what lets a Server-side tool resolve its own aliases through
 * the same API a Client uses.
 */

import { ObjectIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass, type QualifiedName } from "node-opcua-data-model";
import { type ExpandedNodeId, type NodeId, NodeId as NodeIdClass, resolveNodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { AliasNameDataType, AliasNameVerboseDataType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { AliasNameCallError, AliasNameMethodNotSupportedError } from "./errors.js";
import { ServerIndexResolver } from "./server_index_resolver.js";

/** `Aliases`, the root of the hierarchy (OPC 10000-17 clause 9.2). */
export const ALIASES_ROOT: NodeId = resolveNodeId(ObjectIds.Aliases);
/** `TagVariables` (clause 9.3). */
export const TAG_VARIABLES: NodeId = resolveNodeId(ObjectIds.TagVariables);
/** `Topics` (clause 9.4). */
export const TOPICS: NodeId = resolveNodeId(ObjectIds.Topics);

/** One resolved AliasName, as `FindAlias` reports it (clause 7.2). */
export interface ClientAliasEntry {
    /** The string part of the AliasName. */
    aliasName: string;
    /**
     * The namespace the AliasName was published in.
     *
     * Clause 6.2 requires a Client to **ignore this when comparing** AliasNames.
     * It is reported for completeness, not for matching.
     */
    namespaceIndex: number;
    /** The Nodes the alias names, best match first (clause 6.3.2). */
    referencedNodes: ExpandedNodeId[];
}

/** One resolved AliasName, as `FindAliasVerbose` reports it (clause 7.3). */
export interface ClientAliasVerboseEntry extends ClientAliasEntry {
    /**
     * Parallel to {@link referencedNodes}: the ServerUri of each Node, `null`
     * for one on the Server that answered.
     */
    serverUris: (string | null)[];
    /**
     * The category that actually held the alias, which for a recursive search is
     * the nested one rather than the one that was called.
     */
    aliasNameCategoryId: NodeId;
}

export interface FindAliasOptions {
    /**
     * The category to search, recursively. Defaults to {@link ALIASES_ROOT},
     * which covers everything the Server publishes.
     */
    categoryNodeId?: NodeId;
    /**
     * Restrict to this ReferenceType and its subtypes (clause 6.3.2 Table 3).
     * Omit for any.
     */
    referenceTypeFilter?: NodeId;
}

/** The Methods a category may carry. */
interface CategoryMethods {
    findAlias: NodeId | null;
    findAliasVerbose: NodeId | null;
    addAliasesToCategory: NodeId | null;
    deleteAliasesFromCategory: NodeId | null;
}

/** Read a QualifiedName's parts defensively — a Server may send a bare string. */
function qualifiedName(value: QualifiedName | undefined): { name: string; namespaceIndex: number } {
    return { name: value?.name ?? "", namespaceIndex: value?.namespaceIndex ?? 0 };
}

/**
 * Client-side entry point for a Server's AliasNames.
 *
 * ```ts
 * const aliases = new ClientAliasSet(session);
 * const [entry] = await aliases.findAlias("TI101");
 * const nodeId = entry.referencedNodes[0];
 * ```
 *
 * Construct one per session: Method NodeIds are resolved lazily, in a single
 * `translateBrowsePath` round trip per category, and cached for the lifetime of
 * the instance.
 *
 * This resolves the aliases **a Server publishes about itself**. Aggregating
 * across Servers (OPC 10000-17 Annexes B and C) is out of scope; where a Server
 * does aggregate, {@link serverIndexResolver} turns the `ServerIndex` of a
 * returned `ExpandedNodeId` into a URI.
 */
export class ClientAliasSet {
    public readonly session: IBasicSessionAsync2;
    /** Resolves the `ServerIndex` of a returned Node (Annex A). */
    public readonly serverIndexResolver: ServerIndexResolver;

    private readonly methodCache = new Map<string, CategoryMethods>();

    constructor(session: IBasicSessionAsync2) {
        this.session = session;
        this.serverIndexResolver = new ServerIndexResolver(session);
    }

    /**
     * Resolve an AliasName, or a `Like` pattern, to the Nodes it names.
     *
     * The pattern is an OPC 10000-4 `Like` pattern: `%` is any run of
     * characters, `_` is exactly one, `[abc]` and `[^abc]` are lists, and `\`
     * escapes. An exact name is simply a pattern with no wildcards.
     *
     * @throws {@link AliasNameCallError} when the Server answers a bad
     * StatusCode — `Bad_InvalidArgument` for a malformed pattern,
     * `Bad_ResponseTooLarge` when a narrower filter is needed,
     * `Bad_UserAccessDenied` when the session may not read the category.
     */
    public async findAlias(pattern: string, options?: FindAliasOptions): Promise<ClientAliasEntry[]> {
        const categoryNodeId = options?.categoryNodeId ?? ALIASES_ROOT;
        const methods = await this.resolveMethods(categoryNodeId);
        if (!methods.findAlias) {
            // FindAlias is MANDATORY, so this means the Node is not an
            // AliasNameCategoryType instance, or the Server is non-conformant
            throw new AliasNameMethodNotSupportedError("FindAlias", categoryNodeId);
        }

        const extensionObjects = await this.callFind(
            "FindAlias",
            categoryNodeId,
            methods.findAlias,
            pattern,
            options?.referenceTypeFilter
        );

        return extensionObjects.map((raw) => {
            const value = raw as AliasNameDataType;
            const { name, namespaceIndex } = qualifiedName(value.aliasName);
            return {
                aliasName: name,
                namespaceIndex,
                referencedNodes: value.referencedNodes ?? []
            };
        });
    }

    /**
     * Resolve an AliasName and learn which category held it and which Server
     * each Node is on (clause 6.3.3).
     *
     * @throws {@link AliasNameMethodNotSupportedError} when the Server exposes
     * only the mandatory `FindAlias`. That is a conformant Server, so this is
     * an expected outcome to handle, not a fault — use {@link supportsVerbose}
     * to check first.
     */
    public async findAliasVerbose(pattern: string, options?: FindAliasOptions): Promise<ClientAliasVerboseEntry[]> {
        const categoryNodeId = options?.categoryNodeId ?? ALIASES_ROOT;
        const methods = await this.resolveMethods(categoryNodeId);
        if (!methods.findAliasVerbose) {
            throw new AliasNameMethodNotSupportedError("FindAliasVerbose", categoryNodeId);
        }

        const extensionObjects = await this.callFind(
            "FindAliasVerbose",
            categoryNodeId,
            methods.findAliasVerbose,
            pattern,
            options?.referenceTypeFilter
        );

        return extensionObjects.map((raw) => {
            const value = raw as AliasNameVerboseDataType;
            const { name, namespaceIndex } = qualifiedName(value.aliasName);
            return {
                aliasName: name,
                namespaceIndex,
                referencedNodes: value.referencedNodes ?? [],
                serverUris: value.serverUris ?? [],
                aliasNameCategoryId: value.aliasNameCategoryId
            };
        });
    }

    /**
     * True when the Server exposes `FindAliasVerbose` on this category.
     *
     * Cheaper than catching {@link AliasNameMethodNotSupportedError}, and reads
     * better when the Client has a fallback path.
     */
    public async supportsVerbose(categoryNodeId: NodeId = ALIASES_ROOT): Promise<boolean> {
        return (await this.resolveMethods(categoryNodeId)).findAliasVerbose !== null;
    }

    /**
     * True when the Server exposes the configuration Methods on this category
     * (clauses 6.3.4 and 6.3.5). They are optional and off by default in most
     * Servers.
     */
    public async supportsConfiguration(categoryNodeId: NodeId = ALIASES_ROOT): Promise<boolean> {
        const methods = await this.resolveMethods(categoryNodeId);
        return methods.addAliasesToCategory !== null && methods.deleteAliasesFromCategory !== null;
    }

    /**
     * The `AliasNameCategoryType` instances Organized directly by a category.
     *
     * Browsing is not needed to *resolve* an alias — `FindAlias` on the root
     * searches recursively — but a Client that wants to show the hierarchy, or
     * to search one branch, needs it.
     */
    public async browseSubCategories(categoryNodeId: NodeId = ALIASES_ROOT): Promise<Array<{ nodeId: NodeId; browseName: string }>> {
        const result = await this.session.browse({
            nodeId: categoryNodeId,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: resolveNodeId("Organizes"),
            includeSubtypes: true,
            nodeClassMask: NodeClass.Object,
            resultMask: 0x3f
        });
        const references = result.references ?? [];
        const out: Array<{ nodeId: NodeId; browseName: string }> = [];
        for (const reference of references) {
            // an AliasNameCategoryType instance carries FindAlias; an
            // AliasNameType instance does not, which is how they are told apart
            // without reading TypeDefinition for each
            const methods = await this.resolveMethods(reference.nodeId);
            if (methods.findAlias) {
                out.push({ nodeId: reference.nodeId, browseName: reference.browseName.name ?? "" });
            }
        }
        return out;
    }

    /** Forget every cached Method NodeId. */
    public invalidate(): void {
        this.methodCache.clear();
        this.serverIndexResolver.invalidate();
    }

    /**
     * Resolve every Method of a category in **one** `translateBrowsePath` round
     * trip, and cache the result.
     *
     * Asking for all four at once costs no more than asking for one, and means a
     * Client that later calls `findAliasVerbose` after `findAlias` makes no
     * further round trip.
     */
    private async resolveMethods(categoryNodeId: NodeId): Promise<CategoryMethods> {
        const key = categoryNodeId.toString();
        const cached = this.methodCache.get(key);
        if (cached) {
            return cached;
        }

        const names = ["FindAlias", "FindAliasVerbose", "AddAliasesToCategory", "DeleteAliasesFromCategory"] as const;
        const results = await this.session.translateBrowsePath(names.map((name) => makeBrowsePath(categoryNodeId, `/${name}`)));

        const pick = (index: number): NodeId | null => {
            const result = results[index];
            return result?.statusCode.isGood() && result.targets?.length ? result.targets[0].targetId : null;
        };
        const methods: CategoryMethods = {
            findAlias: pick(0),
            findAliasVerbose: pick(1),
            addAliasesToCategory: pick(2),
            deleteAliasesFromCategory: pick(3)
        };
        this.methodCache.set(key, methods);
        return methods;
    }

    /** Call one of the two find Methods and return its ExtensionObject array. */
    private async callFind(
        methodName: string,
        categoryNodeId: NodeId,
        methodId: NodeId,
        pattern: string,
        referenceTypeFilter?: NodeId
    ): Promise<unknown[]> {
        const result = await this.session.call({
            objectId: categoryNodeId,
            methodId,
            inputArguments: [
                { dataType: DataType.String, value: pattern },
                // an omitted filter is the null NodeId, not a null value
                { dataType: DataType.NodeId, value: referenceTypeFilter ?? NodeIdClass.nullNodeId }
            ]
        });

        if (!result.statusCode.isGood()) {
            throw new AliasNameCallError(methodName, categoryNodeId, result.statusCode);
        }

        const output = result.outputArguments?.[0];
        const value = output?.value;
        // no match is Good with an empty list (clause 6.3.2 Table 3)
        if (value === null || value === undefined) {
            return [];
        }
        return Array.isArray(value) ? value : [value];
    }
}
