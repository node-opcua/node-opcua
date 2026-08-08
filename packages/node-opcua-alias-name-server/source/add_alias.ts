/**
 * @module node-opcua-alias-name-server
 *
 * Creating and removing `AliasNameType` instances from code, for Servers whose
 * address space is built programmatically rather than loaded from a NodeSet2.
 */

import type { BaseNode, IAddressSpace, UAObject, UAObjectType } from "node-opcua-address-space-base";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { type NodeId, NodeId as NodeIdClass } from "node-opcua-nodeid";
import { findAliasNameType } from "./alias_hierarchy.js";
import { getInstalledAliasNames } from "./bind_alias_category.js";
import { ALIAS_FOR, ALIAS_NAME_CATEGORY_TYPE, PUBLISHED_DATA_SET_TYPE, WellKnownCategories } from "./well_known.js";

/** Raised when an alias would break a rule of OPC 10000-17. */
export class AliasNameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AliasNameError";
    }
}

export interface AddAliasOptions {
    /**
     * ReferenceType linking the AliasName to its target. Defaults to `AliasFor`
     * (clause 8.2); a subtype is allowed.
     */
    referenceType?: NodeId | string;
    /**
     * Namespace index for the AliasName's BrowseName. Defaults to the Server's
     * own namespace. Clause 6.2 allows namespace 1 or a vendor namespace, and
     * requires Clients to ignore it when comparing.
     */
    namespaceIndex?: number;
    /**
     * Accept a target this Server cannot resolve.
     *
     * For a Node on **another** Server, which by definition is not in this
     * address space: the existence check and the clause 9.3 / 9.4 category
     * restrictions are both skipped, because neither can be evaluated without
     * being a Client of that Server. Used by `AddAliasesToCategory` when
     * `TargetServers` names a remote Server (clause 6.3.4).
     */
    allowUnresolvedTarget?: boolean;
}

/**
 * Add an `AliasNameType` instance under `category`, naming `target`.
 *
 * Enforces clause 6.2:
 *
 * - the string part of the BrowseName equals the DisplayName, with an empty
 *   locale and no other locale;
 * - the Object has at least one `AliasFor` Reference;
 * - the BrowseName is immutable once created. There is deliberately no rename:
 *   "If an AliasName is to be changed, it shall be a deletion of the old
 *   AliasName and the addition of the new AliasName", which yields a new NodeId
 *   and is what lets an aggregating Server notice the change.
 *
 * and the category restrictions of clauses 9.3 and 9.4, where the target is
 * local and therefore checkable.
 *
 * Adding the same (name, target) twice returns the existing node rather than
 * creating a duplicate.
 */
export function addAlias(
    addressSpace: IAddressSpace,
    category: UAObject | NodeId,
    aliasName: string,
    target: BaseNode | NodeId,
    options?: AddAliasOptions
): UAObject {
    const categoryNode = coerceCategory(addressSpace, category);
    const referenceTypeId = coerceReferenceType(addressSpace, options?.referenceType);

    if (!aliasName) {
        throw new AliasNameError("addAlias: the alias name must not be empty");
    }

    // A target on another Server is not in this address space, so it can be
    // neither resolved nor checked against the category restrictions.
    let targetNodeId: NodeId;
    if (options?.allowUnresolvedTarget) {
        targetNodeId = target instanceof NodeIdClass ? target : (target as BaseNode).nodeId;
    } else {
        const targetNode = coerceTarget(addressSpace, target);
        targetNodeId = targetNode.nodeId;
        assertTargetAllowedInCategory(addressSpace, categoryNode, targetNode);
    }

    const existing = findAlias(addressSpace, categoryNode, aliasName);
    if (existing) {
        // clause 6.3.1: multiple <Alias> instances may point at the same Node,
        // and the same name may name several Nodes; adding a target that is
        // already there is a no-op rather than an error
        const alreadyLinked = existing
            .findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)
            .some((reference) => reference.nodeId.toString() === targetNodeId.toString());
        if (!alreadyLinked) {
            existing.addReference({ referenceType: referenceTypeId, nodeId: targetNodeId });
            // clause 6.3.1: "the referenced Nodes of an AliasName in the
            // AliasNameCategory changed"
            notifyAliasChanged(addressSpace, categoryNode.nodeId);
        }
        return existing;
    }

    const aliasNameType = findAliasNameType(addressSpace);
    if (!aliasNameType) {
        throw new AliasNameError("addAlias: AliasNameType (i=23455) is not in the address space");
    }

    const namespace = addressSpace.getNamespace(options?.namespaceIndex ?? addressSpace.getOwnNamespace().index);
    const alias = (aliasNameType as UAObjectType).instantiate({
        browseName: { name: aliasName, namespaceIndex: namespace.index },
        // clause 6.2: the DisplayName is the string part of the BrowseName, with
        // an empty locale and no other locale - hence a single LocalizedText
        // carrying a null locale, not a list
        displayName: { locale: null, text: aliasName },
        organizedBy: categoryNode,
        namespace
    }) as UAObject;

    alias.addReference({ referenceType: referenceTypeId, nodeId: targetNodeId });
    // clause 6.3.1: "an AliasName was added to [...] the AliasNameCategory"
    notifyAliasChanged(addressSpace, categoryNode.nodeId);
    return alias;
}

/**
 * Remove one target from an alias, or the whole alias when no target is given.
 *
 * Removing the last target deletes the `AliasNameType` node: clause 7.2 says the
 * ReferencedNodes array always has at least one entry, so an alias naming
 * nothing cannot be represented.
 *
 * @returns true when something was removed.
 */
export function removeAlias(
    addressSpace: IAddressSpace,
    category: UAObject | NodeId,
    aliasName: string,
    target?: BaseNode | NodeId
): boolean {
    const categoryNode = coerceCategory(addressSpace, category);
    const alias = findAlias(addressSpace, categoryNode, aliasName);
    if (!alias) {
        return false;
    }

    if (!target) {
        addressSpace.deleteNode(alias.nodeId);
        notifyAliasChanged(addressSpace, categoryNode.nodeId);
        return true;
    }

    const targetNodeId = target instanceof NodeIdClass ? target : target.nodeId;
    const references = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward);
    const match = references.find((reference) => reference.nodeId.toString() === targetNodeId.toString());
    if (!match) {
        return false;
    }

    if (references.length === 1) {
        // the last target: the alias itself goes (clause 7.2)
        addressSpace.deleteNode(alias.nodeId);
        notifyAliasChanged(addressSpace, categoryNode.nodeId);
        return true;
    }
    alias.removeReference({ referenceType: match.referenceType, nodeId: targetNodeId });
    notifyAliasChanged(addressSpace, categoryNode.nodeId);
    return true;
}

/** The `AliasNameType` instance with this name Organized by `category`, if any. */
export function findAlias(addressSpace: IAddressSpace, category: UAObject, aliasName: string): UAObject | null {
    const aliasNameType = findAliasNameType(addressSpace);
    if (!aliasNameType) {
        return null;
    }
    for (const child of category.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward)) {
        if (child.nodeClass !== NodeClass.Object) {
            continue;
        }
        // clause 6.2: compare the string part only, ignoring the namespace
        if (child.browseName.name !== aliasName) {
            continue;
        }
        const typeDefinition = (child as UAObject).typeDefinitionObj;
        if (
            typeDefinition &&
            (typeDefinition.nodeId.value === aliasNameType.nodeId.value || typeDefinition.isSubtypeOf(aliasNameType))
        ) {
            return child as UAObject;
        }
    }
    return null;
}

/**
 * Enforce the target restrictions of clauses 9.3 and 9.4.
 *
 * `TagVariables` restricts targets to Variables; `Topics` restricts them to
 * `PublishedDataSetType` instances or subtypes. Both are checked only where the
 * target is local — a Node on another Server cannot be inspected, which is the
 * same reason clause 6.3.4 has `Uncertain_ReferenceOutOfServer`.
 *
 * The restriction applies to the whole subtree: an alias nested three levels
 * below `TagVariables` is still "in the TagVariables hierarchy" (clause 9.3).
 */
function assertTargetAllowedInCategory(addressSpace: IAddressSpace, category: UAObject, target: BaseNode): void {
    if (isWithin(addressSpace, category, WellKnownCategories.TagVariables)) {
        if (target.nodeClass !== NodeClass.Variable) {
            throw new AliasNameError(
                `addAlias: TagVariables restricts targets to Variables (OPC 10000-17 clause 9.3); ` +
                    `${target.browseName.toString()} is a ${NodeClass[target.nodeClass]}`
            );
        }
    }
    if (isWithin(addressSpace, category, WellKnownCategories.Topics)) {
        const publishedDataSetType = addressSpace.findObjectType(PUBLISHED_DATA_SET_TYPE);
        const typeDefinition = target.nodeClass === NodeClass.Object ? (target as UAObject).typeDefinitionObj : null;
        const ok =
            publishedDataSetType &&
            typeDefinition &&
            (typeDefinition.nodeId.value === publishedDataSetType.nodeId.value || typeDefinition.isSubtypeOf(publishedDataSetType));
        if (!ok) {
            throw new AliasNameError(
                `addAlias: Topics restricts targets to PublishedDataSetType or a subtype ` +
                    `(OPC 10000-17 clause 9.4); ${target.browseName.toString()} is not one`
            );
        }
    }
}

/** True when `category` is `ancestorNodeId` or nested anywhere below it. */
function isWithin(addressSpace: IAddressSpace, category: UAObject, ancestorNodeId: NodeId): boolean {
    const ancestor = addressSpace.findNode(ancestorNodeId);
    if (!ancestor) {
        return false;
    }
    const seen = new Set<string>();
    const walkUp = (node: BaseNode): boolean => {
        const key = node.nodeId.toString();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        if (key === ancestor.nodeId.toString()) {
            return true;
        }
        for (const parent of node.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Inverse)) {
            if (walkUp(parent)) {
                return true;
            }
        }
        return false;
    };
    return walkUp(category);
}

/** Accept either a category node or its NodeId. */
function coerceCategory(addressSpace: IAddressSpace, category: UAObject | NodeId): UAObject {
    if (!(category instanceof NodeIdClass)) {
        return category;
    }
    const node = addressSpace.findNode(category);
    if (!node || node.nodeClass !== NodeClass.Object) {
        throw new AliasNameError(`addAlias: ${category.toString()} is not an Object in this address space`);
    }
    const typeDefinition = (node as UAObject).typeDefinitionObj;
    const categoryType = addressSpace.findObjectType(ALIAS_NAME_CATEGORY_TYPE);
    if (
        categoryType &&
        typeDefinition &&
        typeDefinition.nodeId.value !== categoryType.nodeId.value &&
        !typeDefinition.isSubtypeOf(categoryType)
    ) {
        throw new AliasNameError(`addAlias: ${category.toString()} is not an AliasNameCategoryType instance`);
    }
    return node as UAObject;
}

/** Accept either a target node or its NodeId. */
function coerceTarget(addressSpace: IAddressSpace, target: BaseNode | NodeId): BaseNode {
    if (!(target instanceof NodeIdClass)) {
        return target;
    }
    const node = addressSpace.findNode(target);
    if (!node) {
        throw new AliasNameError(`addAlias: target ${target.toString()} does not exist in this address space`);
    }
    return node;
}

/** Resolve the ReferenceType, defaulting to `AliasFor` (clause 8.2). */
function coerceReferenceType(addressSpace: IAddressSpace, referenceType: NodeId | string | undefined): NodeId {
    if (!referenceType) {
        return ALIAS_FOR;
    }
    const resolved = typeof referenceType === "string" ? addressSpace.findReferenceType(referenceType)?.nodeId : referenceType;
    if (!resolved) {
        throw new AliasNameError(`addAlias: unknown ReferenceType ${String(referenceType)}`);
    }
    const aliasFor = addressSpace.findReferenceType(ALIAS_FOR);
    const candidate = addressSpace.findReferenceType(resolved);
    if (aliasFor && candidate && candidate.nodeId.value !== aliasFor.nodeId.value && !candidate.isSubtypeOf(aliasFor)) {
        throw new AliasNameError(
            `addAlias: ${candidate.browseName.toString()} is not AliasFor or a subtype of it (OPC 10000-17 clause 8.2)`
        );
    }
    return resolved;
}

/**
 * Tell the installed `LastChange` tracker that a category changed
 * (clause 6.3.1).
 *
 * Routed through whatever installation recorded on the address space rather
 * than through a parameter, so `addAlias` keeps its simple signature and a
 * Server that has not installed AliasNames is unaffected. Fire and forget: the
 * Property is written synchronously, only the persistence write is async, and
 * failing to persist must not fail the caller's add.
 */
function notifyAliasChanged(addressSpace: IAddressSpace, categoryNodeId: NodeId): void {
    const installed = getInstalledAliasNames(addressSpace);
    void installed?.lastChange?.touch(categoryNodeId);
}
