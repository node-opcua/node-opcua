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
import { LastChangeTracker } from "./last_change.js";
import { DEFAULT_MAX_RESULTS, WellKnownCategories } from "./well_known.js";

export { DEFAULT_MAX_RESULTS };

/**
 * Supplies the `AliasNameCategoryType` instances to bind.
 *
 * Defaults to {@link defaultCategoryProvider}, which walks down from `Aliases`.
 * Replace it when the category set is not a static tree — one category per
 * customer, one per upstream Server, categories that appear and disappear at
 * runtime. May be asynchronous, since the set may have to be fetched.
 *
 * A provider only decides *what installation binds*. Categories created after
 * installation are bound with {@link bindAliasCategory}, or created already
 * bound with {@link addAliasCategory}.
 */
export type CategoryProvider = (addressSpace: IAddressSpace) => UAObject[] | Promise<UAObject[]>;

/**
 * The default provider: every `AliasNameCategoryType` instance at or below
 * `Aliases`, plus any roots named in `additionalCategoryRoots`.
 *
 * `additionalCategoryRoots` is expressed through this rather than as a parallel
 * mechanism, so a custom provider can reuse it — `defaultCategoryProvider(roots)`
 * composes with whatever else the Server knows about.
 */
export function defaultCategoryProvider(additionalRoots?: Array<NodeId | UAObject>): CategoryProvider {
    return (addressSpace: IAddressSpace) => collectAllCategories(addressSpace, additionalRoots);
}

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
     * (clauses 6.3.4 and 6.3.5, conformance unit *AliasName Configuration
     * Support*, CU 5874).
     *
     * **Off by default**: both Methods are Optional, and a write surface that
     * appears without being asked for is a surface nobody reviewed. Turning it
     * on is not by itself dangerous — every call is denied until
     * {@link isWriteAllowed} says otherwise — but the Methods do become visible
     * to a browsing Client.
     */
    configurationMethods?: boolean;
    /** Passed to the `Like` matcher used by the default store. */
    likeOptions?: LikeOptions;
    /** Result ordering (clause 6.3.2, "best match first"). */
    comparator?: AliasComparator;
    /**
     * Read gate, consulted **per category** and allowed to be asynchronous.
     * Defaults to allowing everyone, so a Server that simply publishes its
     * aliases is unaffected.
     *
     * A direct call on a denied category answers `Bad_UserAccessDenied`; a
     * denied category reached by a recursive search is omitted and the call
     * still returns `Good`, so nothing reveals that it exists.
     *
     * OPC 10000-17 defines no security model — four `Bad_UserAccessDenied` rows,
     * no Security clause, no Roles, and no `RolePermissions` on any Part 17 node
     * in the standard nodeset — so every Server has to supply its own rule.
     */
    isReadAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /**
     * Write gate for the configuration Methods, mirroring
     * {@link isReadAllowed}. **Defaults to denying everyone**: the write surface
     * is the one place where a permissive default would be a security defect
     * rather than a convenience.
     */
    isWriteAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /**
     * File backing the persisted `LastChange` values (clause 6.3.1: *"The
     * LastChange shall be persisted"*).
     *
     * Without it, every restart resets `LastChange` to zero — and a Client that
     * sees a value older than the one it cached is required by clause 6.3.1 to
     * clear its cache. So an unpersisted Server silently orders every connected
     * Client to discard a still-valid cache on every restart. Set this on any
     * Server that Clients cache against.
     *
     * The file is small JSON: a version and a map of category NodeId to
     * VersionTime. Writes are atomic.
     */
    persistencePath?: string;
    /**
     * Add a `LastChange` Property to every category, not only the `Aliases` root.
     *
     * On by default. `LastChange` is Optional on `AliasNameCategoryType` and the
     * shipped nodeset instantiates it only on the root, which clause 9.2 makes
     * mandatory — but the clause 6.3.1 rollup is only observable where the
     * Property exists, so a Client watching one branch needs it there. Turn it
     * off to keep the address space exactly as the nodeset ships it.
     */
    lastChangeOnAllCategories?: boolean;
    /**
     * Supplies "now" as a VersionTime, for tests that need to pin it. A
     * VersionTime has one-second resolution, which is otherwise awkward to
     * assert against.
     */
    nowVersionTime?: () => number;
    /**
     * Extra roots to search for `AliasNameCategoryType` instances.
     *
     * Categories are discovered by walking down from `Aliases`, which is where
     * clause 9.1 puts them. Name a category here if the Server models one
     * outside that hierarchy, otherwise its MANDATORY `FindAlias` stays unbound.
     *
     * Ignored when {@link categoryProvider} is supplied — compose it in with
     * {@link defaultCategoryProvider} instead of passing both.
     */
    additionalCategoryRoots?: Array<NodeId | UAObject>;
    /**
     * Replace category discovery entirely. See {@link CategoryProvider}.
     */
    categoryProvider?: CategoryProvider;
    /**
     * Declare the `ALIAS` ServerCapability (OPC 10000-12 Annex D Table D.1).
     * **On by default.**
     *
     * A Server that does not advertise it is never discovered by anything
     * looking for alias-capable Servers, and nothing reports the failure — so
     * leaving it to each caller to remember means it will sometimes be
     * forgotten, invisibly. Installing the feature and declaring it are the same
     * decision, so they happen together.
     *
     * **Call `installAliasNames` before `server.start()`.** The address space
     * exists from `initialize()` onwards, and mDNS/LDS registration reads the
     * capability list during `start()` — afterwards the list is still correct
     * for anything reading `ServerConfiguration`, but the registration has
     * already gone out without it.
     *
     * Set false if the Server manages its own capability list.
     */
    advertiseCapability?: boolean;
}

export interface InstallAliasNamesResult {
    /** The store that was used — the injected one, or the default. */
    store: IAliasStore;
    /** Every `AliasNameCategoryType` instance that had its Methods bound. */
    categories: NodeId[];
    /** True when this call did the work; false when AliasNames were already installed. */
    installed: boolean;
    /**
     * Keeps `LastChange` correct across the hierarchy, and persists it
     * (clause 6.3.1).
     *
     * The binding advances it by itself for every change that flows through this
     * package — `addAlias`, `removeAlias`, `addAliasCategory`, and the
     * `AddAliasesToCategory` / `DeleteAliasesFromCategory` Methods. A host that
     * mutates an **injected store out-of-band** — replacing entries during a
     * reconcile, pulling a fresh snapshot from a database — is the one case the
     * binding cannot see, so such a host reports the change itself:
     *
     * ```ts
     * const { lastChange } = await installAliasNames(server, { store: myStore });
     * // ... after each out-of-band mutation of myStore:
     * await lastChange?.touch(categoryNodeId);
     * ```
     *
     * `touch(categoryNodeId, versionTime?)` records the change on that category
     * and rolls it up to every ancestor including the `Aliases` root, exactly as
     * an internal change would (clause 6.3.1's nested-category rule). Omit
     * `versionTime` to use "now"; pass one to backdate a change that was
     * discovered late. This is the supported API for out-of-band store
     * mutations.
     */
    lastChange?: LastChangeTracker;
    /**
     * The options every category was bound with.
     *
     * Pass these to {@link bindAliasCategory} to bind a category created later
     * exactly as the installed ones were bound, without reassembling them by
     * hand and risking a different store or result cap.
     */
    bindingOptions: BindAliasCategoryOptions;
}

/** The server-like object we need: the address space, and the capability list. */
export interface IServerForAliasNames {
    engine: {
        addressSpace: IAddressSpace | null;
    };
    /**
     * The Server's OPC 10000-12 Annex D capability identifiers — on an
     * `OPCUAServer` this is `capabilitiesForMDNS`. Optional so a caller can pass
     * anything address-space-shaped; when present, `ALIAS` is added to it.
     */
    capabilitiesForMDNS?: string[];
}

/**
 * The `ALIAS` ServerCapability identifier (OPC 10000-12 Annex D Table D.1).
 *
 * Part 17's prose writes it `Alias`; Part 12 Annex D is the normative source and
 * writes `ALIAS`, matched case-insensitively.
 */
export const ALIAS_SERVER_CAPABILITY_ID = "ALIAS";

/** The placeholder node-opcua uses for "no capabilities declared". */
const NO_CAPABILITY_PLACEHOLDER = "NA";

/**
 * Add `ALIAS` to a Server's Annex D capability list, in place.
 *
 * Idempotent, case-insensitive, and replaces the `NA` placeholder rather than
 * producing the meaningless `["NA", "ALIAS"]`.
 *
 * @returns true when the list was changed.
 */
export function advertiseAliasCapability(capabilities: string[]): boolean {
    if (capabilities.some((c) => c.toUpperCase() === ALIAS_SERVER_CAPABILITY_ID)) {
        return false;
    }
    // "NA" means "none"; it cannot coexist with a real capability
    const placeholderIndex = capabilities.findIndex((c) => c.toUpperCase() === NO_CAPABILITY_PLACEHOLDER);
    if (placeholderIndex >= 0) {
        capabilities.splice(placeholderIndex, 1);
    }
    capabilities.push(ALIAS_SERVER_CAPABILITY_ID);
    return true;
}

/**
 * Install AliasName support on a Server.
 *
 * Call it **between `initialize()` and `start()`**: the address space exists
 * from `initialize()`, and the `ALIAS` capability has to be in place before
 * `start()` performs the mDNS/LDS registration that reads it.
 *
 * ```ts
 * await server.initialize();
 * await installAliasNames(server);
 * await server.start();
 * ```
 */
export async function installAliasNames(
    server: IServerForAliasNames,
    options?: InstallAliasNamesOptions
): Promise<InstallAliasNamesResult> {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("installAliasNames: address space is not available. Call this after server.initialize().");
    }

    const result = await installAliasNamesOnAddressSpace(addressSpace, options);

    // Declaring the capability is part of installing the feature, not a separate
    // thing to remember: a Server that omits it is never discovered, silently.
    if ((options?.advertiseCapability ?? true) && server.capabilitiesForMDNS) {
        advertiseAliasCapability(server.capabilitiesForMDNS);
    }
    return result;
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

    const aliasesRoot = addressSpace.findNode(WellKnownCategories.Aliases);
    if (!aliasesRoot) {
        throw new Error(
            "installAliasNames: the Aliases Object (i=23470) is not in the address space. " +
                "Load the standard nodeset (Opc.Ua.NodeSet2.xml) first."
        );
    }

    const store = options?.store ?? new AddressSpaceAliasStore(addressSpace, { likeOptions: options?.likeOptions });

    const lastChange = new LastChangeTracker(addressSpace, {
        persistencePath: options?.persistencePath,
        now: options?.nowVersionTime
    });

    const bindingOptions: BindAliasCategoryOptions = {
        store,
        maxResults: options?.maxResults ?? DEFAULT_MAX_RESULTS,
        verbose: options?.verbose ?? true,
        comparator: options?.comparator,
        isReadAllowed: options?.isReadAllowed,
        isWriteAllowed: options?.isWriteAllowed,
        lastChangeProperty: options?.lastChangeOnAllCategories ?? true,
        configurationMethods: options?.configurationMethods ?? false,
        onChanged: (categoryNodeId: NodeId) => lastChange.touch(categoryNodeId).then(() => undefined)
    };

    const provider = options?.categoryProvider ?? defaultCategoryProvider(options?.additionalCategoryRoots);
    const categories = await provider(addressSpace);

    // one binding path, shared with bindAliasCategory, so a category created
    // after installation cannot end up bound differently
    for (const category of categories) {
        bindAliasCategory(addressSpace, category, bindingOptions);
    }

    const installed = {
        store,
        categories: categories.map((c) => c.nodeId),
        bindingOptions,
        lastChange
    };
    // Recorded before restore, so anything the restore triggers can already find
    // the tracker on the address space.
    setInstalledAliasNames(addressSpace, installed);

    // Bring persisted values back and publish them, including the zeros for
    // categories that have never changed - a Property with no value at all reads
    // as Bad_WaitingForInitialData rather than "nothing has happened yet".
    await lastChange.restore();
    lastChange.publishAll(installed.categories);

    return { ...installed, installed: true };
}
