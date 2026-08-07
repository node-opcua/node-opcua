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

import type { IAddressSpace, ISessionContext, UAMethod, UAObject, UAObjectType } from "node-opcua-address-space-base";
import type { IAliasStore } from "node-opcua-alias-name-common";
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, NodeId as NodeIdClass } from "node-opcua-nodeid";
import { type AliasComparator, makeFindAliasHandler } from "./bind_find_alias.js";
import {
    ALIAS_NAME_CATEGORY_TYPE,
    DEFAULT_MAX_RESULTS,
    MethodDeclarations,
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
    const categoryType = addressSpace.findObjectType(ALIAS_NAME_CATEGORY_TYPE);
    if (!categoryType) {
        throw new Error("addAliasCategory: AliasNameCategoryType (i=23456) is not in the address space");
    }

    const namespace = addressSpace.getNamespace(options?.namespaceIndex ?? addressSpace.getOwnNamespace().index);
    const category = (categoryType as UAObjectType).instantiate({
        browseName: { name: browseName, namespaceIndex: namespace.index },
        nodeId: options?.nodeId,
        organizedBy: parentNode,
        namespace
    }) as UAObject;

    const bindingOptions = resolveBindingOptions(addressSpace, options);
    if (bindingOptions) {
        bindAliasCategory(addressSpace, category, bindingOptions);
    }
    return category;
}

/**
 * Merge explicit options over whatever installation recorded, or return null
 * when there is nothing to bind with.
 */
function resolveBindingOptions(
    addressSpace: IAddressSpace,
    options?: AddAliasCategoryOptions
): BindAliasCategoryOptions | null {
    const installed = getInstalledAliasNames(addressSpace);
    const store = options?.store ?? installed?.bindingOptions.store;
    if (!store) {
        // nothing to bind against yet; installAliasNames will pick this category
        // up when it runs, since it is Organized below its parent
        return null;
    }
    return {
        store,
        maxResults: options?.maxResults ?? installed?.bindingOptions.maxResults ?? DEFAULT_MAX_RESULTS,
        verbose: options?.verbose ?? installed?.bindingOptions.verbose,
        comparator: options?.comparator ?? installed?.bindingOptions.comparator,
        isReadAllowed: options?.isReadAllowed ?? installed?.bindingOptions.isReadAllowed
    };
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
