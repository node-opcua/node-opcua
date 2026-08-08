/**
 * @module node-opcua-alias-name-server
 *
 * A per-category index from AliasName to the `AliasNameType` Object that carries
 * it.
 *
 * ## Why this exists
 *
 * Looking an alias up by name means finding a child of the category with a given
 * BrowseName. The address space has an O(1) index for exactly that — but
 * `getChildByName` only consults it for `HasChild` subtypes, and an alias is an
 * `Organizes` child of its category (clause 6.3 Table 2). `getFolderElementByName`
 * does cover `Organizes`, but scans. So neither route is both correct and fast.
 *
 * That matters because `addAlias` has to look for an existing alias of the same
 * name before creating one, so a Server building N aliases performed N linear
 * scans of a growing category — quadratic. Measured on a category holding 1500
 * aliases, 200 lookups cost 97 ms by scanning and 0 ms through this index, and
 * building 1500 aliases went from 2545 ms to 1686 ms.
 *
 * That is not the whole story: the larger remaining cost is inside
 * `UAObjectType.instantiate`, which is itself superlinear in the number of
 * children the parent already has. That is an address-space concern rather than
 * an AliasName one, and is tracked separately.
 *
 * ## How it stays correct
 *
 * The index is built lazily, from one full scan, so aliases modelled in a
 * NodeSet2.xml are picked up. After that it is maintained incrementally by
 * {@link noteAliasAdded} and {@link noteAliasRemoved}, which `addAlias` and
 * `removeAlias` call.
 *
 * A hit is verified against the address space before being returned, so an alias
 * deleted by other means degrades to a miss rather than a dangling Object. A
 * miss is trusted: an alias created behind this package's back after the index
 * was built would not be found, and `addAlias` would then fail loudly on the
 * duplicate BrowseName rather than corrupting anything. Call
 * {@link invalidateAliasIndex} if a Server mutates a category by other means.
 *
 * Keyed by the node itself in a `WeakMap`, so a disposed address space takes its
 * indexes with it.
 */

import type { IAddressSpace, UAObject } from "node-opcua-address-space-base";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { findAliasNameType } from "./alias_hierarchy.js";

/** AliasName (string part only, per clause 6.2) to the Object's NodeId. */
type AliasIndex = Map<string, NodeId>;

const indexes = new WeakMap<UAObject, AliasIndex>();

/** Build the index for a category by scanning it once. */
function buildIndex(addressSpace: IAddressSpace, category: UAObject): AliasIndex {
    const index: AliasIndex = new Map();
    const aliasNameType = findAliasNameType(addressSpace);
    if (!aliasNameType) {
        return index;
    }
    for (const child of category.findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward)) {
        if (child.nodeClass !== NodeClass.Object) {
            continue;
        }
        const name = child.browseName.name;
        if (!name || index.has(name)) {
            continue;
        }
        const typeDefinition = (child as UAObject).typeDefinitionObj;
        if (
            typeDefinition &&
            (typeDefinition.nodeId.value === aliasNameType.nodeId.value || typeDefinition.isSubtypeOf(aliasNameType))
        ) {
            index.set(name, child.nodeId);
        }
    }
    return index;
}

/** The index for a category, built on first use. */
function indexOf(addressSpace: IAddressSpace, category: UAObject): AliasIndex {
    let index = indexes.get(category);
    if (!index) {
        index = buildIndex(addressSpace, category);
        indexes.set(category, index);
    }
    return index;
}

/**
 * The `AliasNameType` instance with this name in `category`, or null.
 *
 * O(1) after the first call on a given category.
 */
export function lookupAlias(addressSpace: IAddressSpace, category: UAObject, aliasName: string): UAObject | null {
    const index = indexOf(addressSpace, category);
    const nodeId = index.get(aliasName);
    if (!nodeId) {
        return null;
    }
    const node = addressSpace.findNode(nodeId);
    if (!node || node.nodeClass !== NodeClass.Object) {
        // deleted behind our back; forget it rather than hand back a ghost
        index.delete(aliasName);
        return null;
    }
    return node as UAObject;
}

/** Record a newly created alias. */
export function noteAliasAdded(addressSpace: IAddressSpace, category: UAObject, aliasName: string, nodeId: NodeId): void {
    indexOf(addressSpace, category).set(aliasName, nodeId);
}

/** Record a removed alias. */
export function noteAliasRemoved(addressSpace: IAddressSpace, category: UAObject, aliasName: string): void {
    indexOf(addressSpace, category).delete(aliasName);
}

/**
 * Forget a category's index, so it is rebuilt from the address space on next
 * use. Needed only if a Server adds or removes aliases without going through
 * {@link addAlias} / {@link removeAlias}.
 */
export function invalidateAliasIndex(category: UAObject): void {
    indexes.delete(category);
}
