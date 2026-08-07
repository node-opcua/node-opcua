/**
 * @module node-opcua-alias-name-server
 *
 * Walking the AliasName hierarchy in the address space (OPC 10000-17
 * clause 6.3.1).
 */

import type { BaseNode, IAddressSpace, UAObject, UAObjectType } from "node-opcua-address-space-base";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { ALIAS_NAME_CATEGORY_TYPE, ALIAS_NAME_TYPE, WellKnownCategories } from "./well_known.js";

/** True when `node` is an Object whose TypeDefinition is `type` or a subtype. */
function isInstanceOf(node: BaseNode, type: UAObjectType | null): boolean {
    if (!type || node.nodeClass !== NodeClass.Object) {
        return false;
    }
    const typeDefinition = (node as UAObject).typeDefinitionObj;
    if (!typeDefinition) {
        return false;
    }
    return typeDefinition.nodeId.value === type.nodeId.value || typeDefinition.isSubtypeOf(type);
}

/** Resolve `AliasNameCategoryType`, or null on an address space without Part 17. */
export function findAliasNameCategoryType(addressSpace: IAddressSpace): UAObjectType | null {
    return addressSpace.findObjectType(ALIAS_NAME_CATEGORY_TYPE);
}

/** Resolve `AliasNameType`, or null on an address space without Part 17. */
export function findAliasNameType(addressSpace: IAddressSpace): UAObjectType | null {
    return addressSpace.findObjectType(ALIAS_NAME_TYPE);
}

/** True when `node` is an instance of `AliasNameCategoryType` (or a subtype). */
export function isAliasNameCategory(addressSpace: IAddressSpace, node: BaseNode): boolean {
    return isInstanceOf(node, findAliasNameCategoryType(addressSpace));
}

/** True when `node` is an instance of `AliasNameType` (or a subtype). */
export function isAliasName(addressSpace: IAddressSpace, node: BaseNode): boolean {
    return isInstanceOf(node, findAliasNameType(addressSpace));
}

/**
 * The Organized children of a category.
 *
 * `findReferencesExAsObject` follows subtypes of the ReferenceType, so a vendor
 * subtype of `Organizes` is included, and `HierarchicalReferences` is used as
 * the base so a Server that nests categories with `HasComponent` is not missed.
 */
function organizedChildren(category: UAObject): BaseNode[] {
    return category.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward);
}

/**
 * Every `AliasNameCategoryType` instance at or below `root`, depth first.
 *
 * A category may legitimately be reached more than once — clause 6.3.1 allows an
 * `<Alias>` (and by extension a subtree) to appear in more than one place — so
 * `seen` both de-duplicates and makes a cyclic hierarchy terminate rather than
 * hang the Method call.
 */
export function collectCategories(addressSpace: IAddressSpace, root: UAObject): UAObject[] {
    const result: UAObject[] = [];
    const seen = new Set<string>();

    const visit = (category: UAObject): void => {
        const key = category.nodeId.toString();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        result.push(category);
        for (const child of organizedChildren(category)) {
            if (isAliasNameCategory(addressSpace, child)) {
                visit(child as UAObject);
            }
        }
    };

    visit(root);
    return result;
}

/** The `AliasNameType` instances Organized directly by `category`. */
export function aliasesOf(addressSpace: IAddressSpace, category: UAObject): UAObject[] {
    const result: UAObject[] = [];
    for (const child of organizedChildren(category)) {
        if (isAliasName(addressSpace, child)) {
            result.push(child as UAObject);
        }
    }
    return result;
}

/**
 * Every `AliasNameCategoryType` instance reachable from `Aliases`, plus any
 * roots named explicitly.
 *
 * Discovery walks the hierarchy below `Aliases` rather than sweeping the whole
 * address space, because that is where clause 9.1 puts categories: vendors "are
 * free to add additional instances of AliasNameCategoryType under this
 * hierarchy". There is also no way to sweep — the address space keeps no inverse
 * `HasTypeDefinition` reference from an ObjectType to its instances, so a type
 * cannot be asked for them.
 *
 * `additionalRoots` is the escape hatch for a Server that models a category
 * somewhere else: without it that category's MANDATORY `FindAlias` would stay
 * unbound, which is the very defect this package exists to fix.
 */
export function collectAllCategories(addressSpace: IAddressSpace, additionalRoots?: Array<NodeId | UAObject>): UAObject[] {
    const byId = new Map<string, UAObject>();

    const roots: BaseNode[] = [];
    const aliasesRoot = addressSpace.findNode(WellKnownCategories.Aliases);
    if (aliasesRoot) {
        roots.push(aliasesRoot);
    }
    for (const extra of additionalRoots ?? []) {
        const node = "nodeClass" in extra ? extra : addressSpace.findNode(extra);
        if (node) {
            roots.push(node);
        }
    }

    for (const root of roots) {
        if (root.nodeClass !== NodeClass.Object) {
            continue;
        }
        for (const category of collectCategories(addressSpace, root as UAObject)) {
            byId.set(category.nodeId.toString(), category);
        }
    }
    return [...byId.values()];
}

/** The NodeIds of the well-known categories present in this address space. */
export function presentWellKnownCategories(addressSpace: IAddressSpace): NodeId[] {
    return Object.values(WellKnownCategories).filter((nodeId) => addressSpace.findNode(nodeId) !== null);
}
