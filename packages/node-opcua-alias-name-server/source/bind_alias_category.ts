/**
 * @module node-opcua-alias-name-server
 *
 * Binding the Methods of a single `AliasNameCategoryType` instance, and creating
 * new categories at runtime.
 *
 * This is the one binding path. `installAliasNamesOnAddressSpace` calls
 * {@link bindAliasCategory} in its loop rather than doing the work itself, so a
 * category created after installation cannot end up bound differently from one
 * that was there at install time — or, worse, not bound at all. An unbound
 * MANDATORY `FindAlias` is the exact defect this package exists to remove, and
 * it should not be able to reappear at runtime.
 */

import type {
    BaseNode,
    IAddressSpace,
    ISessionContext,
    UAMethod,
    UAObject,
    UAObjectType,
    UAVariable
} from "node-opcua-address-space-base";
import type { IAliasStore } from "node-opcua-alias-name-common";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { type NodeId, NodeId as NodeIdClass, NodeIdType } from "node-opcua-nodeid";
import type { RolePermissionTypeOptions } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { makeAddAliasesToCategoryHandler, makeDeleteAliasesFromCategoryHandler } from "./bind_configuration_methods.js";
import { type AliasComparator, makeFindAliasHandler } from "./bind_find_alias.js";
import { LAST_CHANGE_BROWSE_NAME, type LastChangeTracker } from "./last_change.js";
import {
    ALIAS_NAME_CATEGORY_TYPE,
    DEFAULT_MAX_RESULTS,
    MethodDeclarations,
    VERSION_TIME_DATA_TYPE,
    WellKnownCategories,
    WellKnownOptionalMethods
} from "./well_known.js";

/** Everything a category needs in order to answer `FindAlias`. */
export interface BindAliasCategoryOptions {
    /** Where aliases come from. */
    store: IAliasStore;
    /** Result cap per call (clause 6.3.2 Table 4). */
    maxResults: number;
    /** Also bind `FindAliasVerbose`, adding the Method if the instance lacks it. */
    verbose?: boolean;
    /** Result ordering (clause 6.3.2, "best match first"). */
    comparator?: AliasComparator;
    /** Read gate; see {@link FindAliasBindingOptions.isReadAllowed}. */
    isReadAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /**
     * Write gate for the configuration Methods, mirroring `isReadAllowed`.
     * Defaults to denying everyone.
     */
    isWriteAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /** Also add and bind `AddAliasesToCategory` / `DeleteAliasesFromCategory`. */
    configurationMethods?: boolean;
    /** Ensure the category carries a `LastChange` Property (clause 6.3.1). */
    lastChangeProperty?: boolean;
    /** Called after a configuration Method changed the category. */
    onChanged?: (categoryNodeId: NodeId) => void | Promise<void>;
}

/**
 * Bind `FindAlias` — and, when `verbose`, `FindAliasVerbose` — on one
 * `AliasNameCategoryType` instance.
 *
 * Safe to call on a category that is already bound: `bindMethod` replaces the
 * handler, and the optional Method is only added when it is missing.
 *
 * Use this for a category created after `installAliasNames` has run. The options
 * that installation used are on {@link InstallAliasNamesResult.bindingOptions},
 * so a caller does not have to reassemble them and risk binding a late category
 * with a different store or a different result cap.
 */
export function bindAliasCategory(addressSpace: IAddressSpace, category: UAObject, options: BindAliasCategoryOptions): void {
    const findAlias = findMethodByDeclaration(category, MethodDeclarations.FindAlias, "FindAlias");
    findAlias?.bindMethod(makeFindAliasHandler(options, false));

    if (options.verbose ?? true) {
        const verbose = ensureOptionalMethod(addressSpace, category, "FindAliasVerbose");
        verbose?.bindMethod(makeFindAliasHandler(options, true));
    }

    if (options.lastChangeProperty ?? true) {
        ensureLastChangeProperty(addressSpace, category);
    }

    // The write surface only appears when asked for (clause 6.3.4 / 6.3.5 are
    // both Optional), and even then every call is denied unless isWriteAllowed
    // says otherwise.
    if (options.configurationMethods) {
        const configurationOptions = {
            store: options.store,
            isWriteAllowed: options.isWriteAllowed,
            onChanged: options.onChanged
        };
        const add = ensureOptionalMethod(addressSpace, category, "AddAliasesToCategory");
        add?.bindMethod(makeAddAliasesToCategoryHandler(configurationOptions));
        const remove = ensureOptionalMethod(addressSpace, category, "DeleteAliasesFromCategory");
        remove?.bindMethod(makeDeleteAliasesFromCategoryHandler(configurationOptions));
    }
}

/**
 * The default NodeId for a new category: a **string** NodeId spelling out its
 * path under `Aliases`, for instance `ns=1;s=Aliases/TagVariables/Unit200`.
 *
 * The obvious alternative — letting the namespace assign the next free numeric
 * id — is wrong here for two reasons.
 *
 * It is **not stable across restarts**. The counter depends on how many other
 * Nodes were created first, so adding one unrelated Variable to a Server shifts
 * every category's NodeId. That silently breaks `LastChange` persistence, which
 * keys on the category NodeId: the restored values no longer match any
 * category, `LastChange` reads 0, and clause 6.3.1 then requires every connected
 * Client to clear a cache that was perfectly valid. A Server-side change with a
 * purely remote symptom.
 *
 * It is also **not diagnosable**. `ns=1;i=1010` in a log or a
 * `FindAliasVerbose` result says nothing; `ns=1;s=Aliases/TagVariables/Unit200`
 * says which category it is without a lookup.
 *
 * The path is unique because two categories cannot share a parent and a
 * BrowseName, and it is derived from the same information every run, so it is
 * the same NodeId every run.
 */
function defaultCategoryNodeId(parent: UAObject, browseName: string, namespaceIndex: number): NodeId {
    const path = [...categoryPathOf(parent), browseName].join("/");
    return new NodeIdClass(NodeIdType.STRING, path, namespaceIndex);
}

/**
 * The BrowseNames from the `Aliases` root down to `category`, inclusive.
 *
 * Falls back to the category's own BrowseName when it is not under the root,
 * which keeps the id derivable for a category modelled outside the standard
 * hierarchy.
 */
function categoryPathOf(category: UAObject): string[] {
    const segments: string[] = [];
    const seen = new Set<string>();
    let current: UAObject | null = category;

    while (current) {
        const key: string = current.nodeId.toString();
        if (seen.has(key)) {
            break;
        }
        seen.add(key);
        segments.unshift(current.browseName.name ?? key);

        if (key === WellKnownCategories.Aliases.toString()) {
            break;
        }
        const parents: BaseNode[] = current.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Inverse);
        const next = parents.find((p) => p.nodeClass === NodeClass.Object);
        current = next ? (next as UAObject) : null;
    }
    return segments;
}

/**
 * Ensure a category has a `LastChange` Property.
 *
 * `LastChange` is Optional on `AliasNameCategoryType` and the shipped nodeset
 * instantiates it only on the `Aliases` root, which clause 9.2 makes mandatory.
 * Adding it to every category is conformant — Optional means may, not must not —
 * and it is what makes the clause 6.3.1 rollup observable: without it, a Client
 * watching one branch has nothing to watch.
 */
export function ensureLastChangeProperty(addressSpace: IAddressSpace, category: UAObject): UAVariable | null {
    const existing = category.getPropertyByName(LAST_CHANGE_BROWSE_NAME);
    if (existing) {
        return existing;
    }
    const namespace = addressSpace.getNamespace(
        category.nodeId.namespace === 0 ? addressSpace.getOwnNamespace().index : category.nodeId.namespace
    );
    return namespace.addVariable({
        propertyOf: category,
        browseName: LAST_CHANGE_BROWSE_NAME,
        // VersionTime (i=20998) is a UInt32 subtype, not a DateTime
        dataType: VERSION_TIME_DATA_TYPE,
        minimumSamplingInterval: 1000,
        value: { dataType: DataType.UInt32, value: 0 }
    }) as UAVariable;
}

export interface AddAliasCategoryOptions extends Partial<BindAliasCategoryOptions> {
    /**
     * Namespace for the new category's BrowseName. Defaults to the Server's own.
     */
    namespaceIndex?: number;
    /**
     * NodeId for the new category. Defaults to a server-assigned one, which is
     * correct for any category the specification does not name.
     */
    nodeId?: NodeId;
    /**
     * ObjectType to instantiate. Defaults to `AliasNameCategoryType`; a subtype
     * is accepted, since discovery and binding both already handle subtypes.
     */
    categoryType?: UAObjectType | NodeId;
    /**
     * RolePermissions for the new category.
     *
     * Worth setting deliberately. Namespace 0 declares no `RolePermissions` on
     * any Part 17 node, so a category created without them inherits the
     * namespace default silently — which is a decision either way, just an
     * invisible one.
     */
    rolePermissions?: RolePermissionTypeOptions[];
}

/**
 * Create a vendor `AliasNameCategoryType` instance under `parent` **and bind it**.
 *
 * Creating one by hand means instantiating the type, wiring the `Organizes`
 * reference and then remembering to bind — and a category whose `FindAlias` is
 * unbound fails conformance silently. This does all three.
 *
 * When `installAliasNames` has already run on this address space, the binding
 * options it used are reused unless overridden, so a category added at runtime
 * behaves exactly like one that was present at install time. Pass a `store`
 * explicitly if installation has not run yet.
 */
export function addAliasCategory(
    addressSpace: IAddressSpace,
    parent: UAObject | NodeId,
    browseName: string,
    options?: AddAliasCategoryOptions
): UAObject {
    const parentNode = coerceCategoryNode(addressSpace, parent);
    const categoryType = resolveCategoryType(addressSpace, options?.categoryType);

    const namespace = addressSpace.getNamespace(options?.namespaceIndex ?? addressSpace.getOwnNamespace().index);
    const nodeId = options?.nodeId ?? defaultCategoryNodeId(parentNode, browseName, namespace.index);

    if (addressSpace.findNode(nodeId)) {
        throw new Error(
            `addAliasCategory: ${nodeId.toString()} already exists. A category's default NodeId is derived from its ` +
                "path under Aliases, so this means a category of the same name already exists under the same parent."
        );
    }

    const category = categoryType.instantiate({
        browseName: { name: browseName, namespaceIndex: namespace.index },
        nodeId,
        organizedBy: parentNode,
        namespace
    }) as UAObject;

    if (options?.rolePermissions) {
        // instantiate() does not take them, so they are applied after
        category.setRolePermissions(options.rolePermissions);
    }

    const bindingOptions = resolveBindingOptions(addressSpace, options);
    if (bindingOptions) {
        bindAliasCategory(addressSpace, category, bindingOptions);
    }
    // clause 6.3.1: "The last time an AliasNameCategory was added or deleted"
    notifyCategoryChanged(addressSpace, parentNode.nodeId);
    return category;
}

/**
 * Resolve the ObjectType to instantiate, defaulting to `AliasNameCategoryType`.
 *
 * A subtype is accepted: discovery matches on "is this an instance of
 * AliasNameCategoryType *or a subtype*", and binding looks the Methods up by
 * MethodDeclarationId, so neither cares which exact type was used.
 */
function resolveCategoryType(addressSpace: IAddressSpace, categoryType?: UAObjectType | NodeId): UAObjectType {
    const base = addressSpace.findObjectType(ALIAS_NAME_CATEGORY_TYPE);
    if (!base) {
        throw new Error("addAliasCategory: AliasNameCategoryType (i=23456) is not in the address space");
    }
    if (!categoryType) {
        return base;
    }
    const resolved =
        categoryType instanceof NodeIdClass ? addressSpace.findObjectType(categoryType) : (categoryType as UAObjectType);
    if (!resolved) {
        throw new Error(`addAliasCategory: unknown ObjectType ${String(categoryType)}`);
    }
    if (resolved.nodeId.value !== base.nodeId.value && !resolved.isSubtypeOf(base)) {
        throw new Error(`addAliasCategory: ${resolved.browseName.toString()} is not AliasNameCategoryType or a subtype of it`);
    }
    return resolved;
}

/**
 * Remove a category, and decide what happens to what it Organizes.
 *
 * The specification does not say, so the rule is stated here rather than left to
 * whatever `deleteNode` happens to do:
 *
 * - **`reparent`** (the default) moves the category's aliases and subcategories
 *   to its parent before deleting it. Nothing disappears, so a Client that had
 *   resolved an alias keeps resolving it — the alias Object keeps its NodeId,
 *   and clause 6.2 makes a NodeId change mean "this is a different alias".
 * - **`cascade`** deletes them with it. Correct when the category *is* the
 *   thing being retired, such as a tenant being removed.
 *
 * Refuses to remove one of the three well-known categories, which clause 9
 * requires a Server to have.
 *
 * @returns the aliases and subcategories that were re-parented, or deleted.
 */
export function removeAliasCategory(
    addressSpace: IAddressSpace,
    category: UAObject | NodeId,
    options?: { orphans?: "reparent" | "cascade" }
): { moved: NodeId[]; deleted: NodeId[] } {
    const node = coerceCategoryNode(addressSpace, category);
    for (const wellKnown of Object.values(WellKnownCategories)) {
        if (wellKnown.value === node.nodeId.value && wellKnown.namespace === node.nodeId.namespace) {
            throw new Error(
                `removeAliasCategory: ${node.browseName.toString()} is a well-known category that ` +
                    "OPC 10000-17 clause 9 requires the Server to have"
            );
        }
    }

    const parents = node.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Inverse);
    // Organizes only, not every hierarchical reference. A category's Methods are
    // HasComponent children that belong to it and must go with it; re-parenting
    // those would leave the parent with a second FindAlias.
    const childReferences = node.findReferencesEx("Organizes", BrowseDirection.Forward);
    const orphans = options?.orphans ?? "reparent";
    const moved: NodeId[] = [];
    const deleted: NodeId[] = [];

    if (orphans === "reparent") {
        const parent = parents[0];
        if (!parent) {
            throw new Error(
                `removeAliasCategory: ${node.browseName.toString()} has no parent to re-parent its contents to; ` +
                    'pass { orphans: "cascade" } to delete them instead'
            );
        }
        for (const reference of childReferences) {
            parent.addReference({ referenceType: reference.referenceType, nodeId: reference.nodeId });
            // Detach before deleting: deleteNode cascades through Organizes, so
            // a child still referenced here would be deleted along with the
            // category despite having just been re-parented.
            node.removeReference({ referenceType: reference.referenceType, nodeId: reference.nodeId });
            moved.push(reference.nodeId);
        }
    } else {
        for (const reference of childReferences) {
            deleted.push(reference.nodeId);
        }
    }

    // whatever is still attached goes with it
    addressSpace.deleteNode(node.nodeId);
    // clause 6.3.1: a category was deleted
    for (const parent of parents) {
        notifyCategoryChanged(addressSpace, parent.nodeId);
    }
    return { moved, deleted };
}

/**
 * Tell the installed `LastChange` tracker that a category's contents changed.
 *
 * Fire and forget: the Property is written synchronously and only the
 * persistence write is async, so a failure to persist must not fail the
 * caller's structural change.
 */
function notifyCategoryChanged(addressSpace: IAddressSpace, categoryNodeId: NodeId): void {
    const installed = getInstalledAliasNames(addressSpace);
    void installed?.lastChange?.touch(categoryNodeId);
}

/**
 * Merge explicit options over whatever installation recorded, or return null
 * when there is nothing to bind with.
 */
function resolveBindingOptions(addressSpace: IAddressSpace, options?: AddAliasCategoryOptions): BindAliasCategoryOptions | null {
    const installed = getInstalledAliasNames(addressSpace);
    const inherited = installed?.bindingOptions;
    const store = options?.store ?? inherited?.store;
    if (!store) {
        // nothing to bind against yet; installAliasNames will pick this category
        // up when it runs, since it is Organized below its parent
        return null;
    }

    // Inherit by spreading rather than by listing fields. Cherry-picking meant
    // every new binding option had to be remembered here too, and forgetting one
    // let a category created at runtime diverge from an installed one - silently,
    // and in whichever direction was least safe.
    const merged: BindAliasCategoryOptions = {
        ...inherited,
        store,
        maxResults: options?.maxResults ?? inherited?.maxResults ?? DEFAULT_MAX_RESULTS
    };

    // Only keys the caller actually supplied override the inherited value; an
    // absent key must not read as "false".
    for (const key of Object.keys(options ?? {}) as Array<keyof AddAliasCategoryOptions>) {
        const value = options?.[key];
        if (
            value === undefined ||
            key === "namespaceIndex" ||
            key === "nodeId" ||
            key === "categoryType" ||
            key === "rolePermissions"
        ) {
            continue;
        }
        Object.assign(merged, { [key]: value });
    }
    return merged;
}

/** Accept a category node or its NodeId. */
function coerceCategoryNode(addressSpace: IAddressSpace, node: UAObject | NodeId): UAObject {
    if (!(node instanceof NodeIdClass)) {
        return node;
    }
    const found = addressSpace.findNode(node);
    if (!found || found.nodeClass !== NodeClass.Object) {
        throw new Error(`addAliasCategory: ${node.toString()} is not an Object in this address space`);
    }
    return found as UAObject;
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
export function findMethodByDeclaration(category: UAObject, declarationId: NodeId, browseName: string): UAMethod | null {
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
export function ensureOptionalMethod(
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

/**
 * Marks an address space as already carrying AliasName bindings, so a second
 * `installAliasNames` is a no-op rather than a double binding.
 */
export const INSTALLED = Symbol.for("node-opcua-alias-name-server.installed");

/** What installation recorded on the address space, if it has run. */
export interface InstalledAliasNames {
    store: IAliasStore;
    categories: NodeId[];
    bindingOptions: BindAliasCategoryOptions;
    /** Keeps `LastChange` correct across the hierarchy (clause 6.3.1). */
    lastChange?: LastChangeTracker;
}

type MaybeInstalled = { [INSTALLED]?: InstalledAliasNames };

/**
 * What `installAliasNames` recorded on this address space, or undefined if it
 * has not run.
 *
 * Exposed so a caller can rebind a late category with exactly the options
 * installation used, without having to keep the install result around.
 */
export function getInstalledAliasNames(addressSpace: IAddressSpace): InstalledAliasNames | undefined {
    return (addressSpace as IAddressSpace & MaybeInstalled)[INSTALLED];
}

/** Record the installation on the address space. */
export function setInstalledAliasNames(addressSpace: IAddressSpace, value: InstalledAliasNames): void {
    (addressSpace as IAddressSpace & MaybeInstalled)[INSTALLED] = value;
}
