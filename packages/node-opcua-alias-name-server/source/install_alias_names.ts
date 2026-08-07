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

import type { IAddressSpace, ISessionContext, UAObject } from "node-opcua-address-space-base";
import type { IAliasStore, LikeOptions } from "node-opcua-alias-name-common";
import type { NodeId } from "node-opcua-nodeid";
import { AddressSpaceAliasStore } from "./address_space_alias_store.js";
import { collectAllCategories } from "./alias_hierarchy.js";
import {
    type BindAliasCategoryOptions,
    bindAliasCategory,
    getInstalledAliasNames,
    setInstalledAliasNames
} from "./bind_alias_category.js";
import type { AliasComparator } from "./bind_find_alias.js";
import { WellKnownCategories } from "./well_known.js";

/** Default result cap; beyond it a call answers `Bad_ResponseTooLarge`. */
export const DEFAULT_MAX_RESULTS = 1000;

/**
 * Supplies the `AliasNameCategoryType` instances to bind.
 *
 * Defaults to walking down from `Aliases`. Replace it when the category set is
 * dynamic — one per customer, one per upstream Server — and cannot be described
 * by a fixed list of roots known at install time.
 */
export type CategoryDiscovery = (addressSpace: IAddressSpace) => UAObject[];

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
     *
     * **Not implemented yet** — passing `true` throws rather than silently
     * exposing nothing.
     */
    configurationMethods?: boolean;
    /** Passed to the `Like` matcher used by the default store. */
    likeOptions?: LikeOptions;
    /** Result ordering (clause 6.3.2, "best match first"). */
    comparator?: AliasComparator;
    /**
     * Read gate; return false to answer `Bad_UserAccessDenied`
     * (clause 6.3.2 Table 4). Receives the category the Method was called on, and
     * may return a Promise. Defaults to allowing everyone.
     */
    isReadAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /**
     * File backing the persisted `LastChange` values (clause 6.3.1: "The
     * LastChange shall be persisted"). A Client that sees a value older than
     * the one it cached is required to drop its cache, so a restart that resets
     * `LastChange` to zero is a bug visible in every connected Client.
     *
     * **Not implemented yet** — passing a path throws rather than accepting it
     * and persisting nothing, which would leave a Server believing persistence
     * was on.
     */
    persistencePath?: string;
    /**
     * Extra roots to search for `AliasNameCategoryType` instances.
     *
     * Categories are discovered by walking down from `Aliases`, which is where
     * clause 9.1 puts them. Name a category here if the Server models one
     * outside that hierarchy, otherwise its MANDATORY `FindAlias` stays unbound.
     *
     * Ignored when {@link discoverCategories} is supplied.
     */
    additionalCategoryRoots?: Array<NodeId | UAObject>;
    /**
     * Replace category discovery entirely. See {@link CategoryDiscovery}.
     */
    discoverCategories?: CategoryDiscovery;
}

export interface InstallAliasNamesResult {
    /** The store that was used — the injected one, or the default. */
    store: IAliasStore;
    /** Every `AliasNameCategoryType` instance that had its Methods bound. */
    categories: NodeId[];
    /** True when this call did the work; false when AliasNames were already installed. */
    installed: boolean;
    /**
     * The options every category was bound with.
     *
     * Pass these to {@link bindAliasCategory} to bind a category created later
     * exactly as the installed ones were bound, without reassembling them by
     * hand and risking a different store or result cap.
     */
    bindingOptions: BindAliasCategoryOptions;
}

/** The server-like object we need: just access to the address space. */
export interface IServerForAliasNames {
    engine: {
        addressSpace: IAddressSpace | null;
    };
}

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
    const already = getInstalledAliasNames(addressSpace);
    if (already) {
        return { ...already, installed: false };
    }

    // Refuse the options that are declared but not yet honoured, rather than
    // accepting them and doing nothing. A Server that believes LastChange is
    // being persisted has a defect visible in every connected Client.
    if (options?.configurationMethods) {
        throw new Error(
            "installAliasNames: configurationMethods is not implemented yet " +
                "(AddAliasesToCategory / DeleteAliasesFromCategory, OPC 10000-17 clauses 6.3.4 and 6.3.5)."
        );
    }
    if (options?.persistencePath !== undefined) {
        throw new Error(
            "installAliasNames: persistencePath is not implemented yet " +
                "(LastChange persistence, OPC 10000-17 clause 6.3.1). Omit it rather than " +
                "relying on persistence that is not happening."
        );
    }

    const aliasesRoot = addressSpace.findNode(WellKnownCategories.Aliases);
    if (!aliasesRoot) {
        throw new Error(
            "installAliasNames: the Aliases Object (i=23470) is not in the address space. " +
                "Load the standard nodeset (Opc.Ua.NodeSet2.xml) first."
        );
    }

    const store = options?.store ?? new AddressSpaceAliasStore(addressSpace, { likeOptions: options?.likeOptions });

    const bindingOptions: BindAliasCategoryOptions = {
        store,
        maxResults: options?.maxResults ?? DEFAULT_MAX_RESULTS,
        verbose: options?.verbose ?? true,
        comparator: options?.comparator,
        isReadAllowed: options?.isReadAllowed
    };

    const discover: CategoryDiscovery =
        options?.discoverCategories ?? ((space) => collectAllCategories(space, options?.additionalCategoryRoots));
    const categories = discover(addressSpace);

    // one binding path, shared with bindAliasCategory, so a category created
    // after installation cannot end up bound differently
    for (const category of categories) {
        bindAliasCategory(addressSpace, category, bindingOptions);
    }

    const installed = {
        store,
        categories: categories.map((c) => c.nodeId),
        bindingOptions
    };
    setInstalledAliasNames(addressSpace, installed);
    return { ...installed, installed: true };
}
