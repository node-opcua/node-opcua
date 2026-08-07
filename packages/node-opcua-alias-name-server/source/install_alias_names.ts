/**
 * @module node-opcua-alias-name-server
 *
 * Install OPC 10000-17 AliasName support on a Server.
 *
 * Every node-opcua Server that loads the standard nodeset already exposes
 * `Aliases`, `TagVariables` and `Topics`, each carrying a MANDATORY `FindAlias`
 * Method that is bound to nothing. A conformance tester therefore sees the SDK
 * advertise the AliasName feature and then fail its only required Method. This
 * binds them.
 */

import type { IAddressSpace, ISessionContext, UAMethod, UAObject } from "node-opcua-address-space-base";
import type { IAliasStore, LikeOptions } from "node-opcua-alias-name-common";
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { AddressSpaceAliasStore } from "./address_space_alias_store.js";
import { collectAllCategories } from "./alias_hierarchy.js";
import { type AliasComparator, makeFindAliasHandler } from "./bind_find_alias.js";
import { MethodDeclarations, WellKnownCategories, WellKnownOptionalMethods } from "./well_known.js";

/** Default result cap; beyond it a call answers `Bad_ResponseTooLarge`. */
export const DEFAULT_MAX_RESULTS = 1000;

export interface InstallAliasNamesOptions {
    /**
     * Where aliases come from. Defaults to an {@link AddressSpaceAliasStore},
     * which reads them straight out of the address space — so a Server whose
     * NodeSet2.xml already models `AliasNameType` instances needs no options at
     * all.
     */
    store?: IAliasStore;
    /** Result cap per call (clause 6.3.2 Table 4). Defaults to {@link DEFAULT_MAX_RESULTS}. */
    maxResults?: number;
    /**
     * Also bind `FindAliasVerbose` (clause 6.3.3, conformance unit
     * AliasName FindAliasVerbose). On by default: it costs one extra Method per
     * category and is what lets a Client see which category held a hit.
     */
    verbose?: boolean;
    /**
     * Also expose `AddAliasesToCategory` and `DeleteAliasesFromCategory`
     * (clauses 6.3.4 and 6.3.5, conformance unit AliasName Configuration
     * Support). Off by default, so the write surface does not appear unless it
     * is asked for.
     */
    configurationMethods?: boolean;
    /** Passed to the `Like` matcher used by the default store. */
    likeOptions?: LikeOptions;
    /** Result ordering (clause 6.3.2, "best match first"). */
    comparator?: AliasComparator;
    /**
     * Read gate; return false to answer `Bad_UserAccessDenied`
     * (clause 6.3.2 Table 4). Defaults to allowing everyone.
     */
    isReadAllowed?: (context: ISessionContext) => boolean;
    /**
     * File backing the persisted `LastChange` values (clause 6.3.1: "The
     * LastChange shall be persisted"). A Client that sees a value older than
     * the one it cached is required to drop its cache, so a restart that resets
     * `LastChange` to zero is a bug visible in every connected Client.
     */
    persistencePath?: string;
    /**
     * Extra roots to search for `AliasNameCategoryType` instances.
     *
     * Categories are discovered by walking down from `Aliases`, which is where
     * clause 9.1 puts them. Name a category here if the Server models one
     * outside that hierarchy, otherwise its MANDATORY `FindAlias` stays unbound.
     */
    additionalCategoryRoots?: Array<NodeId | UAObject>;
}

export interface InstallAliasNamesResult {
    /** The store that was used — the injected one, or the default. */
    store: IAliasStore;
    /** Every `AliasNameCategoryType` instance that had its Methods bound. */
    categories: NodeId[];
    /** True when this call did the work; false when AliasNames were already installed. */
    installed: boolean;
}

/** The server-like object we need: just access to the address space. */
export interface IServerForAliasNames {
    engine: {
        addressSpace: IAddressSpace | null;
    };
}

/**
 * Marks an address space as already carrying AliasName bindings, so a second
 * `installAliasNames` is a no-op rather than a double binding.
 */
const INSTALLED = Symbol.for("node-opcua-alias-name-server.installed");

type MaybeInstalled = { [INSTALLED]?: InstallAliasNamesResult };

/**
 * Install AliasName support on a Server. Call after `server.start()`, when the
 * address space exists.
 */
export async function installAliasNames(
    server: IServerForAliasNames,
    options?: InstallAliasNamesOptions
): Promise<InstallAliasNamesResult> {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("installAliasNames: address space is not available. Call this after server.start().");
    }
    return installAliasNamesOnAddressSpace(addressSpace, options);
}

/**
 * Install AliasName support directly on an address space.
 *
 * The two-tier form used elsewhere in the SDK: this one needs no Server, so it
 * can be driven from a test or from a tool that only has an address space.
 */
export async function installAliasNamesOnAddressSpace(
    addressSpace: IAddressSpace,
    options?: InstallAliasNamesOptions
): Promise<InstallAliasNamesResult> {
    const marker = addressSpace as IAddressSpace & MaybeInstalled;
    const already = marker[INSTALLED];
    if (already) {
        return { ...already, installed: false };
    }

    const aliasesRoot = addressSpace.findNode(WellKnownCategories.Aliases);
    if (!aliasesRoot) {
        throw new Error(
            "installAliasNames: the Aliases Object (i=23470) is not in the address space. " +
                "Load the standard nodeset (Opc.Ua.NodeSet2.xml) first."
        );
    }

    const store = options?.store ?? new AddressSpaceAliasStore(addressSpace, { likeOptions: options?.likeOptions });
    const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
    const verbose = options?.verbose ?? true;
    const configurationMethods = options?.configurationMethods ?? false;

    const bindingOptions = {
        store,
        maxResults,
        comparator: options?.comparator,
        isReadAllowed: options?.isReadAllowed
    };
    const findAliasHandler = makeFindAliasHandler(bindingOptions, false);
    const findAliasVerboseHandler = makeFindAliasHandler(bindingOptions, true);

    const categories = collectAllCategories(addressSpace, options?.additionalCategoryRoots);

    for (const category of categories) {
        bindFindAlias(category, findAliasHandler);
        if (verbose) {
            const method = ensureOptionalMethod(addressSpace, category, "FindAliasVerbose");
            method?.bindMethod(findAliasVerboseHandler);
        }
    }

    // The configuration Methods (clauses 6.3.4 / 6.3.5) are the next slice; the
    // flag is accepted now so the option shape does not change when they land.
    if (configurationMethods) {
        throw new Error(
            "installAliasNames: configurationMethods is not implemented yet " +
                "(AddAliasesToCategory / DeleteAliasesFromCategory, OPC 10000-17 clauses 6.3.4 and 6.3.5)."
        );
    }

    const result: InstallAliasNamesResult = {
        store,
        categories: categories.map((c) => c.nodeId),
        installed: true
    };
    marker[INSTALLED] = result;
    return result;
}

/** Bind the mandatory `FindAlias` on a category, if the instance carries one. */
function bindFindAlias(category: UAObject, handler: Parameters<UAMethod["bindMethod"]>[0]): void {
    const method = findMethodByDeclaration(category, MethodDeclarations.FindAlias, "FindAlias");
    method?.bindMethod(handler);
}

/**
 * Find a Method on a category by its MethodDeclarationId, falling back to the
 * BrowseName.
 *
 * The declaration id is the reliable key: a Server may publish the Method under
 * a localised DisplayName, and the BrowseName is only unique within the
 * namespace. The fallback covers instances built in code, which do not always
 * carry a `methodDeclarationId`.
 */
function findMethodByDeclaration(category: UAObject, declarationId: NodeId, browseName: string): UAMethod | null {
    for (const component of category.getComponents()) {
        if (component.nodeClass !== NodeClass.Method) {
            continue;
        }
        const method = component as UAMethod;
        if (method.methodDeclarationId && method.methodDeclarationId.value === declarationId.value) {
            return method;
        }
        if (method.browseName.name === browseName) {
            return method;
        }
    }
    return null;
}

/**
 * Ensure an optional Method exists on a category, adding it when the nodeset
 * only declared it on the type.
 *
 * The shipped `Opc.Ua.NodeSet2.xml` declares `FindAliasVerbose`,
 * `AddAliasesToCategory` and `DeleteAliasesFromCategory` on
 * `AliasNameCategoryType` but instantiates none of them on `Aliases`,
 * `TagVariables` or `Topics`. Upstream nonetheless reserves fixed NodeIds for
 * those instances, so where one exists it is used in preference to a
 * server-assigned id; an aggregating Server then sees the NodeId it expects.
 */
function ensureOptionalMethod(
    addressSpace: IAddressSpace,
    category: UAObject,
    name: "FindAliasVerbose" | "AddAliasesToCategory" | "DeleteAliasesFromCategory"
): UAMethod | null {
    const declarationId = MethodDeclarations[name];
    const existing = findMethodByDeclaration(category, declarationId, name);
    if (existing) {
        return existing;
    }

    const declaration = addressSpace.findNode(declarationId);
    if (!declaration || declaration.nodeClass !== NodeClass.Method) {
        // an address space whose nodeset predates the optional Methods
        return null;
    }

    const reservedNodeId = reservedMethodNodeId(category.nodeId, name);
    // a reserved id already taken by something else means the address space is
    // not what we think it is; fall back to a server-assigned id rather than
    // colliding
    const nodeId = reservedNodeId && !addressSpace.findNode(reservedNodeId) ? reservedNodeId : undefined;

    return (declaration as UAMethod).clone({
        namespace: addressSpace.getNamespace(category.nodeId.namespace),
        nodeId,
        componentOf: category,
        methodDeclarationId: declarationId
    });
}

/** The NodeId OPC 10000-17 reserves for an optional Method on a well-known category. */
function reservedMethodNodeId(
    categoryNodeId: NodeId,
    name: "FindAliasVerbose" | "AddAliasesToCategory" | "DeleteAliasesFromCategory"
): NodeId | undefined {
    for (const [key, wellKnownId] of Object.entries(WellKnownCategories)) {
        if (wellKnownId.value === categoryNodeId.value && wellKnownId.namespace === categoryNodeId.namespace) {
            return WellKnownOptionalMethods[key as keyof typeof WellKnownOptionalMethods][name];
        }
    }
    return undefined;
}
